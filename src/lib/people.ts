// Pure helpers for cast/crew and person pages (no server imports; unit-tested in tests/people.test.ts).

import { KEY_CREW_JOBS, NOISE_GENRE_IDS } from "./constants";

/** Crew we keep: directors, writers (incl. story/teleplay), creators and executive producers. */
export function isKeyCrew(_department: string | null | undefined, job: string | null | undefined): boolean {
  return !!job && KEY_CREW_JOBS.has(job);
}

export type WatchedState = "not_started" | "in_progress" | "completed";

/** How far through a show the viewer is. Unknown totals can never be "completed". */
export function progressState(watched: number, total: number | null | undefined): WatchedState {
  if (watched <= 0) return "not_started";
  if (total != null && total > 0 && watched >= total) return "completed";
  return "in_progress";
}

export function yearOf(date: string | null | undefined): number | null {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isInteger(y) && y > 1800 ? y : null;
}

export function parseGenreIds(csv: string): number[] {
  return csv.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

export function isNoiseGenre(genreIds: number[]): boolean {
  return genreIds.some((g) => NOISE_GENRE_IDS.has(g));
}

// ---------- query parsing ----------

export const SHOW_SORTS = ["date", "rating", "tmdb", "myrating", "billing", "episodes", "name", "role", "progress"] as const;
export type ShowSort = (typeof SHOW_SORTS)[number];
export const EPISODE_SORTS = ["date", "rating", "tmdb", "myrating", "billing", "show", "role", "watched"] as const;
export type EpisodeSort = (typeof EPISODE_SORTS)[number];
export type Dir = "asc" | "desc";

export const SHOW_SORT_LABELS: Record<ShowSort, string> = {
  date: "Release date",
  rating: "Community rating",
  tmdb: "TMDB rating",
  myrating: "Your rating",
  billing: "Billing order",
  episodes: "Episode count",
  name: "Name",
  role: "Role",
  progress: "Progress",
};
export const EPISODE_SORT_LABELS: Record<EpisodeSort, string> = {
  date: "Air date",
  rating: "Community rating",
  tmdb: "TMDB rating",
  myrating: "Your rating",
  billing: "Billing order",
  show: "Show",
  role: "Role",
  watched: "Watched",
};

/** Sensible default direction per sort key (dates/ratings newest or best first). */
export function defaultDirFor(sort: ShowSort | EpisodeSort): Dir {
  return sort === "billing" || sort === "name" || sort === "show" || sort === "role" ? "asc" : "desc";
}

export interface FilmographyQuery {
  sort: ShowSort;
  dir: Dir;
  watched: "any" | WatchedState;
  from: number | null;
  to: number | null;
  /** Include Talk/News/Reality shows. */
  all: boolean;
  /** Include credits with only one episode. */
  singles: boolean;
  dept: "all" | "cast" | "crew";
  esort: EpisodeSort;
  edir: Dir;
  ewatched: "any" | "watched" | "unwatched";
  efrom: number | null;
  eto: number | null;
  eshow: number | null;
}

type SP = Record<string, string | string[] | undefined>;

function str(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}
function year(sp: SP, key: string): number | null {
  const n = Number(str(sp, key));
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
}
function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
function flag(sp: SP, key: string): boolean {
  const v = str(sp, key);
  return v === "1" || v === "on" || v === "true";
}

export function parseFilmographyQuery(sp: SP): FilmographyQuery {
  const sort = oneOf(str(sp, "sort"), SHOW_SORTS, "date");
  const esort = oneOf(str(sp, "esort"), EPISODE_SORTS, "date");
  const eshow = Number(str(sp, "eshow"));
  return {
    sort,
    dir: oneOf(str(sp, "dir"), ["asc", "desc"] as const, defaultDirFor(sort)),
    watched: oneOf(str(sp, "watched"), ["any", "not_started", "in_progress", "completed"] as const, "any"),
    from: year(sp, "from"),
    to: year(sp, "to"),
    all: flag(sp, "all"),
    singles: flag(sp, "singles"),
    dept: oneOf(str(sp, "dept"), ["all", "cast", "crew"] as const, "all"),
    esort,
    edir: oneOf(str(sp, "edir"), ["asc", "desc"] as const, defaultDirFor(esort)),
    ewatched: oneOf(str(sp, "ewatched"), ["any", "watched", "unwatched"] as const, "any"),
    efrom: year(sp, "efrom"),
    eto: year(sp, "eto"),
    eshow: Number.isInteger(eshow) && eshow > 0 ? eshow : null,
  };
}

// ---------- rows ----------

export interface ShowRow {
  creditId: string;
  showId: number;
  name: string;
  posterPath: string | null;
  firstAirDate: string | null;
  kind: "cast" | "crew";
  /** Character for cast, job for crew (all roles joined once grouped). */
  role: string;
  /** Individual roles after grouping (one entry before). */
  roles?: string[];
  department: string | null;
  episodeCount: number;
  genreIds: number[];
  tmdbVoteAverage: number | null;
  /** Mean of all users' episode ratings for the show, or null. */
  communityScore: number | null;
  communityCount: number;
  /** Mean of the viewer's episode ratings for the show, or null. */
  yourScore: number | null;
  /** Billing order from the show's aggregate credits; null until that show is cached. */
  billing: number | null;
  watchedCount: number;
  totalEpisodes: number | null;
  cached: boolean;
  scanned: boolean;
}

export interface EpisodeRow {
  creditId: string;
  episodeId: number;
  showId: number;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
  kind: "cast" | "guest" | "crew";
  role: string;
  roles?: string[];
  billing: number | null;
  tmdbVoteAverage: number | null;
  communityScore: number | null;
  communityCount: number;
  yourScore: number | null;
  watched: boolean;
}

function inYearRange(date: string | null, from: number | null, to: number | null): boolean {
  if (from == null && to == null) return true;
  const y = yearOf(date);
  if (y == null) return false;
  return (from == null || y >= from) && (to == null || y <= to);
}

/** Per-credit filters (role, noise genres, watched state, year). The 1-episode rule is applied after grouping. */
export function filterShows(rows: ShowRow[], q: FilmographyQuery): ShowRow[] {
  return rows.filter((r) => {
    if (q.dept !== "all" && r.kind !== q.dept) return false;
    if (!q.all && isNoiseGenre(r.genreIds)) return false;
    if (q.watched !== "any" && progressState(r.watchedCount, r.totalEpisodes) !== q.watched) return false;
    return inYearRange(r.firstAirDate, q.from, q.to);
  });
}

/**
 * One row per show: roles joined (cast roles first), episode count = the largest credit,
 * kind = cast if any credit is a cast credit. Then drops 1-episode shows unless q.singles.
 */
export function groupShowRows(rows: ShowRow[], q: FilmographyQuery): ShowRow[] {
  const byShow = new Map<number, ShowRow & { roles: string[] }>();
  for (const r of rows) {
    const g = byShow.get(r.showId);
    if (!g) {
      byShow.set(r.showId, { ...r, roles: r.role ? [r.role] : [] });
      continue;
    }
    if (r.role && !g.roles.includes(r.role)) {
      if (r.kind === "cast" && g.kind !== "cast") g.roles.unshift(r.role);
      else g.roles.push(r.role);
    }
    if (r.kind === "cast") g.kind = "cast";
    g.episodeCount = Math.max(g.episodeCount, r.episodeCount);
    if (g.department == null) g.department = r.department;
  }
  return [...byShow.values()]
    .map(({ roles, ...g }) => ({ ...g, role: roles.join(", "), roles }))
    .filter((g) => q.singles || g.episodeCount > 1);
}

/** filter → group → sort, in one call. */
export function prepareShows(rows: ShowRow[], q: FilmographyQuery): ShowRow[] {
  return sortShows(groupShowRows(filterShows(rows, q), q), q);
}

export function filterEpisodes(rows: EpisodeRow[], q: FilmographyQuery): EpisodeRow[] {
  return rows.filter((r) => {
    if (q.ewatched === "watched" && !r.watched) return false;
    if (q.ewatched === "unwatched" && r.watched) return false;
    if (q.eshow != null && r.showId !== q.eshow) return false;
    return inYearRange(r.airDate, q.efrom, q.eto);
  });
}

/**
 * Generic comparator: `key` extracts a number or string; nulls always sort last regardless
 * of direction; `tiebreak` decides equal keys.
 */
function compareBy<T>(
  key: (r: T) => number | string | null,
  dir: Dir,
  tiebreak: (a: T, b: T) => number,
): (a: T, b: T) => number {
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka == null && kb == null) return tiebreak(a, b);
    if (ka == null) return 1;
    if (kb == null) return -1;
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    return tiebreak(a, b);
  };
}

/** 0..1 share of the show watched; unknown totals count as 0 once anything is watched; nothing watched with unknown total → null. */
export function progressFraction(r: Pick<ShowRow, "watchedCount" | "totalEpisodes">): number | null {
  if (r.totalEpisodes && r.totalEpisodes > 0) return Math.min(1, r.watchedCount / r.totalEpisodes);
  return r.watchedCount > 0 ? 0 : null;
}

/**
 * Clicking a column header: a new column sorts ascending; clicking the active column flips
 * the direction (asc → desc → asc …). Returns the href for that next state.
 */
export function headerSortHref(
  base: string,
  q: FilmographyQuery,
  section: "shows" | "episodes",
  column: ShowSort | EpisodeSort,
): string {
  if (section === "shows") {
    const col = column as ShowSort;
    const dir: Dir = q.sort === col ? (q.dir === "asc" ? "desc" : "asc") : "asc";
    return filmographyHref(base, q, { sort: col, dir });
  }
  const col = column as EpisodeSort;
  const edir: Dir = q.esort === col ? (q.edir === "asc" ? "desc" : "asc") : "asc";
  return filmographyHref(base, q, { esort: col, edir });
}

/** "asc" | "desc" when the column is the active sort, otherwise null. */
export function activeSortDir(q: FilmographyQuery, section: "shows" | "episodes", column: string): Dir | null {
  if (section === "shows") return q.sort === column ? q.dir : null;
  return q.esort === column ? q.edir : null;
}

const byName = (a: ShowRow, b: ShowRow) => a.name.localeCompare(b.name) || a.role.localeCompare(b.role);

export function sortShows(rows: ShowRow[], q: FilmographyQuery): ShowRow[] {
  const keys: Record<ShowSort, (r: ShowRow) => number | string | null> = {
    date: (r) => r.firstAirDate || null,
    rating: (r) => r.communityScore,
    tmdb: (r) => (r.tmdbVoteAverage ? r.tmdbVoteAverage : null),
    myrating: (r) => r.yourScore,
    billing: (r) => r.billing,
    episodes: (r) => r.episodeCount,
    name: (r) => r.name.toLocaleLowerCase(),
    role: (r) => (r.role ? r.role.toLocaleLowerCase() : null),
    progress: (r) => progressFraction(r),
  };
  return [...rows].sort(compareBy(keys[q.sort], q.dir, byName));
}

const byEpisodeOrder = (a: EpisodeRow, b: EpisodeRow) =>
  a.showName.localeCompare(b.showName) || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

export function sortEpisodes(rows: EpisodeRow[], q: FilmographyQuery): EpisodeRow[] {
  const keys: Record<EpisodeSort, (r: EpisodeRow) => number | string | null> = {
    date: (r) => r.airDate || null,
    rating: (r) => r.communityScore,
    tmdb: (r) => (r.tmdbVoteAverage ? r.tmdbVoteAverage : null),
    myrating: (r) => r.yourScore,
    billing: (r) => r.billing,
    show: (r) => r.showName.toLocaleLowerCase(),
    role: (r) => (r.role ? r.role.toLocaleLowerCase() : null),
    watched: (r) => (r.watched ? 1 : 0),
  };
  return [...rows].sort(compareBy(keys[q.esort], q.edir, byEpisodeOrder));
}

/** One row per episode: roles joined (cast first), kind = cast > guest > crew, billing = lowest. */
export function groupEpisodeRows(rows: EpisodeRow[]): EpisodeRow[] {
  const rank = { cast: 0, guest: 1, crew: 2 } as const;
  const byEpisode = new Map<number, EpisodeRow & { roles: string[] }>();
  for (const r of rows) {
    const g = byEpisode.get(r.episodeId);
    if (!g) {
      byEpisode.set(r.episodeId, { ...r, roles: r.role ? [r.role] : [] });
      continue;
    }
    if (r.role && !g.roles.includes(r.role)) {
      if (rank[r.kind] < rank[g.kind]) g.roles.unshift(r.role);
      else g.roles.push(r.role);
    }
    if (rank[r.kind] < rank[g.kind]) g.kind = r.kind;
    if (r.billing != null && (g.billing == null || r.billing < g.billing)) g.billing = r.billing;
  }
  return [...byEpisode.values()].map(({ roles, ...g }) => ({ ...g, role: roles.join(", "), roles }));
}

/** filter → group → sort, in one call. */
export function prepareEpisodes(rows: EpisodeRow[], q: FilmographyQuery): EpisodeRow[] {
  return sortEpisodes(groupEpisodeRows(filterEpisodes(rows, q)), q);
}

/**
 * New (from, to) pair after one end of a year range changes. An impossible range is fixed by
 * moving the other end to the value that was just set (from 2015 → to 2014 becomes 2015–2015).
 */
export function coerceYearRange(
  changed: "from" | "to",
  value: number | null,
  from: number | null,
  to: number | null,
): { from: number | null; to: number | null } {
  if (changed === "from") {
    return { from: value, to: value != null && to != null && to < value ? value : to };
  }
  return { to: value, from: value != null && from != null && from > value ? value : from };
}

/** Builds a query string from a query object plus overrides, dropping defaults. */
export function filmographyHref(base: string, q: FilmographyQuery, overrides: Partial<FilmographyQuery> = {}): string {
  const merged = { ...q, ...overrides };
  const params = new URLSearchParams();
  if (merged.sort !== "date") params.set("sort", merged.sort);
  if (merged.dir !== defaultDirFor(merged.sort)) params.set("dir", merged.dir);
  if (merged.watched !== "any") params.set("watched", merged.watched);
  if (merged.from != null) params.set("from", String(merged.from));
  if (merged.to != null) params.set("to", String(merged.to));
  if (merged.all) params.set("all", "1");
  if (merged.singles) params.set("singles", "1");
  if (merged.dept !== "all") params.set("dept", merged.dept);
  if (merged.esort !== "date") params.set("esort", merged.esort);
  if (merged.edir !== defaultDirFor(merged.esort)) params.set("edir", merged.edir);
  if (merged.ewatched !== "any") params.set("ewatched", merged.ewatched);
  if (merged.efrom != null) params.set("efrom", String(merged.efrom));
  if (merged.eto != null) params.set("eto", String(merged.eto));
  if (merged.eshow != null) params.set("eshow", String(merged.eshow));
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
