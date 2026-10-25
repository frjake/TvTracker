import "server-only";

import { unzipSync } from "fflate";
import type { Prisma } from "@/generated/prisma/client";
import { ensureSeason, ensureShow } from "./cache";
import { dateKey } from "./dates";
import { prisma } from "./db";
import {
  type ImportProblem,
  type ImportTarget,
  type ShowRef,
  normalizeZipPath,
  parseExportFiles,
} from "./import-parse";
import { searchTv } from "./tmdb";

// Account import: merge a TvTracker export zip into an account, skipping anything already
// there. planImport() is side-effect free apart from caching TMDB data; executeImport()
// writes the whole plan in one transaction. Imports never create feed activity.

export class ImportError extends Error {}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2000;

/** Unzips the CSVs of an export, refusing archives that would expand beyond sane limits. */
export function readExportZip(bytes: Uint8Array): Record<string, string> {
  let total = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (!normalizeZipPath(f.name)) return false;
        count += 1;
        total += f.originalSize;
        if (count > MAX_FILES || total > MAX_UNCOMPRESSED_BYTES) throw new ImportError("That archive is too large to import.");
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ImportError) throw err;
    throw new ImportError("That file isn't a valid .zip archive.");
  }
  const decoder = new TextDecoder("utf-8");
  const files: Record<string, string> = {};
  for (const [name, data] of Object.entries(entries)) {
    const path = normalizeZipPath(name);
    if (path) files[path] = decoder.decode(data);
  }
  return files;
}

// ---------- matching rows to cached shows / seasons / episodes ----------

const nameKey = (name: string, year: string) => `${name.toLocaleLowerCase()}|${year}`;

function describe(t: ImportTarget): string {
  const show = t.show.name || `TMDB show ${t.show.tmdbId}`;
  return t.kind === "episode" ? `${show} S${t.season}E${t.episode}` : `${show} season ${t.season}`;
}

class TargetResolver {
  private idsByName = new Map<string, number>();
  private searched = new Map<string, number | null>();
  private fetchedSeasons = new Set<string>();
  private fetchedShows = new Set<number>();

  /** Shows named in the zip with an id (diary/watched/lists always have one) let older rows without one match. */
  constructor(refs: ShowRef[], knownShows: { id: number; name: string; firstAirDate: string | null }[]) {
    for (const r of refs) if (r.tmdbId != null && r.name) this.idsByName.set(nameKey(r.name, r.year), r.tmdbId);
    for (const s of knownShows) {
      const key = nameKey(s.name, s.firstAirDate?.slice(0, 4) ?? "");
      if (!this.idsByName.has(key)) this.idsByName.set(key, s.id);
    }
  }

  private async showId(ref: ShowRef): Promise<number | null> {
    if (ref.tmdbId != null) return ref.tmdbId;
    const key = nameKey(ref.name, ref.year);
    const known = this.idsByName.get(key);
    if (known != null) return known;
    if (this.searched.has(key)) return this.searched.get(key)!;
    let found: number | null = null;
    try {
      const results = (await searchTv(ref.name)).results;
      found =
        results.find((r) => r.name.toLocaleLowerCase() === ref.name.toLocaleLowerCase() && (!ref.year || (r.first_air_date ?? "").startsWith(ref.year)))?.id ?? null;
    } catch {
      found = null;
    }
    this.searched.set(key, found);
    return found;
  }

  private async episodeId(showId: number, season: number, episode: number): Promise<number | null> {
    const find = () =>
      prisma.episode.findUnique({
        where: { showId_seasonNumber_episodeNumber: { showId, seasonNumber: season, episodeNumber: episode } },
        select: { id: true },
      });
    const hit = await find();
    if (hit) return hit.id;
    const key = `${showId}:${season}`;
    if (this.fetchedSeasons.has(key)) return null;
    this.fetchedSeasons.add(key);
    try {
      await ensureSeason(showId, season);
    } catch {
      return null;
    }
    return (await find())?.id ?? null;
  }

  private async seasonId(showId: number, season: number): Promise<number | null> {
    const find = () => prisma.season.findUnique({ where: { showId_seasonNumber: { showId, seasonNumber: season } }, select: { id: true } });
    const hit = await find();
    if (hit) return hit.id;
    if (this.fetchedShows.has(showId)) return null;
    this.fetchedShows.add(showId);
    try {
      await ensureShow(showId);
    } catch {
      return null;
    }
    return (await find())?.id ?? null;
  }

  /** Cached ids for a target, fetching from TMDB only when the row isn't cached yet. */
  async resolve(t: ImportTarget): Promise<{ episodeId: number | null; seasonId: number | null } | null> {
    const showId = await this.showId(t.show);
    if (showId == null) return null;
    if (t.kind === "episode") {
      const episodeId = await this.episodeId(showId, t.season, t.episode);
      return episodeId == null ? null : { episodeId, seasonId: null };
    }
    const seasonId = await this.seasonId(showId, t.season);
    return seasonId == null ? null : { episodeId: null, seasonId };
  }
}

// ---------- planning ----------

export interface SectionSummary {
  /** Rows read from the file(s). */
  total: number;
  add: number;
  /** Already in the account (or repeated within the file). */
  skip: number;
  /** Rows that couldn't be read or matched. */
  problems: number;
}

export interface ImportSummary {
  diary: SectionSummary;
  watched: SectionSummary;
  ratings: SectionSummary;
  reviews: SectionSummary;
  listItems: SectionSummary;
  listsNew: number;
  listsExisting: number;
  recognized: string[];
  ignored: string[];
}

interface NewList {
  name: string;
  description: string | null;
  items: { episodeId: number | null; seasonId: number | null; position: number; note: string | null }[];
}

export interface ImportPlan {
  summary: ImportSummary;
  problems: ImportProblem[];
  writes: {
    logs: Prisma.LogEntryCreateManyInput[];
    marks: Prisma.WatchedMarkCreateManyInput[];
    ratings: Prisma.RatingCreateManyInput[];
    reviews: Prisma.ReviewCreateManyInput[];
    newLists: NewList[];
    appendItems: Prisma.ListItemCreateManyInput[];
    touchedListIds: string[];
  };
}

/** Local noon on a YYYY-MM-DD date, plus `seconds` (keeps file order within a day). */
function noonOf(date: string, seconds = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, seconds);
}

const itemKey = (ids: { episodeId: number | null; seasonId: number | null }) =>
  ids.episodeId != null ? `e${ids.episodeId}` : `s${ids.seasonId}`;

const emptySection = (): SectionSummary => ({ total: 0, add: 0, skip: 0, problems: 0 });

export async function planImport(userId: string, files: Record<string, string>): Promise<ImportPlan> {
  const parsed = parseExportFiles(files);
  const problems = [...parsed.problems];
  const now = new Date();

  const [existingLogs, existingMarks, existingRatings, existingReviews, existingLists, knownShows] = await Promise.all([
    prisma.logEntry.findMany({ where: { userId }, select: { episodeId: true, watchedAt: true } }),
    prisma.watchedMark.findMany({ where: { userId }, select: { episodeId: true } }),
    prisma.rating.findMany({ where: { userId }, select: { episodeId: true, seasonId: true } }),
    prisma.review.findMany({ where: { userId }, select: { episodeId: true, seasonId: true } }),
    prisma.list.findMany({ where: { userId }, include: { items: { select: { episodeId: true, seasonId: true, position: true } } } }),
    prisma.show.findMany({ select: { id: true, name: true, firstAirDate: true } }),
  ]);

  const allRefs = [
    ...parsed.diary.map((r) => r.target.show),
    ...parsed.watched.map((r) => r.target.show),
    ...parsed.lists.flatMap((l) => l.items.map((i) => i.target.show)),
    ...parsed.ratings.map((r) => r.target.show),
    ...parsed.reviews.map((r) => r.target.show),
  ];
  const resolver = new TargetResolver(allRefs, knownShows);
  const unmatched = (file: string, row: number, target: ImportTarget) =>
    problems.push({ file, row, message: `Couldn't find ${describe(target)} on TMDB.` });

  const writes: ImportPlan["writes"] = { logs: [], marks: [], ratings: [], reviews: [], newLists: [], appendItems: [], touchedListIds: [] };
  const summary: ImportSummary = {
    diary: emptySection(),
    watched: emptySection(),
    ratings: emptySection(),
    reviews: emptySection(),
    listItems: emptySection(),
    listsNew: 0,
    listsExisting: 0,
    recognized: parsed.recognized,
    ignored: parsed.ignored,
  };
  for (const p of parsed.problems) {
    if (p.row == null) continue;
    const section =
      p.file === "diary.csv" ? summary.diary
      : p.file === "watched.csv" ? summary.watched
      : p.file === "ratings.csv" ? summary.ratings
      : p.file === "reviews.csv" ? summary.reviews
      : p.file.startsWith("lists/") ? summary.listItems
      : null;
    if (section) {
      section.total += 1;
      section.problems += 1;
    }
  }

  // Diary: the same episode on the same date counts as a duplicate. Counted, so a file with an
  // episode logged twice on one day still adds the second copy, but re-importing adds nothing.
  const logCounts = new Map<string, number>();
  for (const l of existingLogs) {
    const key = `${l.episodeId}|${dateKey(l.watchedAt)}`;
    logCounts.set(key, (logCounts.get(key) ?? 0) + 1);
  }
  const watchedEpisodes = new Set<number>([...existingLogs.map((l) => l.episodeId), ...existingMarks.map((m) => m.episodeId)]);
  const secondsIntoDay = new Map<string, number>();
  for (const r of parsed.diary) {
    summary.diary.total += 1;
    const ids = await resolver.resolve(r.target);
    if (!ids?.episodeId) {
      summary.diary.problems += 1;
      unmatched(r.file, r.row, r.target);
      continue;
    }
    const key = `${ids.episodeId}|${r.watchedOn}`;
    const remaining = logCounts.get(key) ?? 0;
    if (remaining > 0) {
      logCounts.set(key, remaining - 1);
      summary.diary.skip += 1;
      continue;
    }
    const seconds = secondsIntoDay.get(r.watchedOn) ?? 0;
    secondsIntoDay.set(r.watchedOn, seconds + 1);
    writes.logs.push({
      userId,
      episodeId: ids.episodeId,
      watchedAt: noonOf(r.watchedOn, seconds),
      rating: r.rating,
      reviewText: r.review,
      rewatch: r.rewatch,
      createdAt: r.loggedOn ? noonOf(r.loggedOn) : now,
    });
    watchedEpisodes.add(ids.episodeId);
    summary.diary.add += 1;
  }

  // Watched: anything already watched (marked, logged, or logged by this import) is skipped.
  for (const r of parsed.watched) {
    summary.watched.total += 1;
    const ids = await resolver.resolve(r.target);
    if (!ids?.episodeId) {
      summary.watched.problems += 1;
      unmatched(r.file, r.row, r.target);
      continue;
    }
    if (watchedEpisodes.has(ids.episodeId)) {
      summary.watched.skip += 1;
      continue;
    }
    watchedEpisodes.add(ids.episodeId);
    writes.marks.push({ userId, episodeId: ids.episodeId, createdAt: r.date ? noonOf(r.date) : now });
    summary.watched.add += 1;
  }

  // Ratings / reviews: one per episode or season; existing ones are kept.
  const ratedKeys = new Set(existingRatings.map(itemKey));
  for (const r of parsed.ratings) {
    summary.ratings.total += 1;
    const ids = await resolver.resolve(r.target);
    if (!ids) {
      summary.ratings.problems += 1;
      unmatched(r.file, r.row, r.target);
      continue;
    }
    const key = itemKey(ids);
    if (ratedKeys.has(key)) {
      summary.ratings.skip += 1;
      continue;
    }
    ratedKeys.add(key);
    const at = r.date ? noonOf(r.date) : now;
    writes.ratings.push({ userId, ...ids, value: r.value, createdAt: at, updatedAt: at });
    summary.ratings.add += 1;
  }

  const reviewedKeys = new Set(existingReviews.map(itemKey));
  for (const r of parsed.reviews) {
    summary.reviews.total += 1;
    const ids = await resolver.resolve(r.target);
    if (!ids) {
      summary.reviews.problems += 1;
      unmatched(r.file, r.row, r.target);
      continue;
    }
    const key = itemKey(ids);
    if (reviewedKeys.has(key)) {
      summary.reviews.skip += 1;
      continue;
    }
    reviewedKeys.add(key);
    const at = r.date ? noonOf(r.date) : now;
    writes.reviews.push({
      userId,
      ...ids,
      body: r.body.slice(0, 10_000),
      containsSpoilers: r.spoilers,
      createdAt: at,
      updatedAt: r.editedAt ? new Date(r.editedAt) : at,
    });
    summary.reviews.add += 1;
  }

  // Lists: matched by name (case-insensitive). Existing lists get the missing items appended in
  // order; new lists are created with their items. Two lists with the same name in one file merge.
  type ListTarget = { present: Set<string>; add: (ids: { episodeId: number | null; seasonId: number | null }, note: string | null) => void };
  const listTargets = new Map<string, ListTarget>();
  const targetFor = (name: string, description: string | null): ListTarget => {
    const key = name.toLocaleLowerCase();
    const cached = listTargets.get(key);
    if (cached) return cached;

    const existing = existingLists.find((l) => l.name.toLocaleLowerCase() === key);
    let target: ListTarget;
    if (existing) {
      summary.listsExisting += 1;
      let position = Math.max(0, ...existing.items.map((i) => i.position));
      target = {
        present: new Set(existing.items.map(itemKey)),
        add: (ids, note) => {
          writes.appendItems.push({ listId: existing.id, ...ids, position: ++position, note });
          if (!writes.touchedListIds.includes(existing.id)) writes.touchedListIds.push(existing.id);
        },
      };
    } else {
      summary.listsNew += 1;
      const list: NewList = { name, description, items: [] };
      writes.newLists.push(list);
      target = { present: new Set(), add: (ids, note) => list.items.push({ ...ids, position: list.items.length + 1, note }) };
    }
    listTargets.set(key, target);
    return target;
  };

  for (const def of parsed.lists) {
    const target = targetFor(def.name, def.description);
    for (const item of def.items) {
      summary.listItems.total += 1;
      const ids = await resolver.resolve(item.target);
      if (!ids) {
        summary.listItems.problems += 1;
        unmatched(item.file, item.row, item.target);
        continue;
      }
      const key = itemKey(ids);
      if (target.present.has(key)) {
        summary.listItems.skip += 1;
        continue;
      }
      target.present.add(key);
      target.add(ids, item.note);
      summary.listItems.add += 1;
    }
  }

  return { summary, problems, writes };
}

/** Writes a plan atomically. */
export async function executeImport(userId: string, plan: ImportPlan): Promise<void> {
  const w = plan.writes;
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (w.logs.length) ops.push(prisma.logEntry.createMany({ data: w.logs }));
  if (w.marks.length) ops.push(prisma.watchedMark.createMany({ data: w.marks }));
  if (w.ratings.length) ops.push(prisma.rating.createMany({ data: w.ratings }));
  if (w.reviews.length) ops.push(prisma.review.createMany({ data: w.reviews }));
  for (const list of w.newLists) {
    ops.push(prisma.list.create({ data: { userId, name: list.name, description: list.description, items: { create: list.items } } }));
  }
  if (w.appendItems.length) ops.push(prisma.listItem.createMany({ data: w.appendItems }));
  if (w.touchedListIds.length) ops.push(prisma.list.updateMany({ where: { id: { in: w.touchedListIds }, userId }, data: { updatedAt: new Date() } }));
  if (ops.length) await prisma.$transaction(ops);
}
