import "server-only";

import type { Credit, Person, PersonTvCredit } from "@/generated/prisma/client";
import { ensureEpisode, ensureSeason, ensureShow } from "./cache";
import { CREDIT_KIND, SCAN_BATCH, TMDB_CACHE_TTL_MS } from "./constants";
import { prisma } from "./db";
import { isKeyCrew } from "./people";
import {
  TmdbError,
  type TmdbAggregateCredits,
  type TmdbEpisodeCredits,
  type TmdbPersonRef,
  getEpisodeCredits,
  getPerson,
  getPersonTvCredits,
  getSeasonAggregateCredits,
  getShow,
  getShowAggregateCredits,
} from "./tmdb";

// Cast & crew cache. Credits for a scope (show / season / episode) are replaced wholesale
// whenever that scope is (re)fetched; Person rows are upserted as stubs (name + photo) and
// filled in by ensurePerson() when someone opens the person page.

export type CreditWithPerson = Credit & { person: Person };

type CreditInput = {
  personId: number;
  showId: number;
  seasonId: number | null;
  episodeId: number | null;
  kind: string;
  character: string | null;
  job: string | null;
  department: string | null;
  order: number | null;
  episodeCount: number | null;
};

function isStale(d: Date | null | undefined) {
  return !d || Date.now() - d.getTime() > TMDB_CACHE_TTL_MS;
}

async function upsertPersonStubs(people: Map<number, TmdbPersonRef>) {
  // Sequential on purpose: the SQLite adapter has one connection.
  for (const p of people.values()) {
    await prisma.person.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, profilePath: p.profile_path },
      update: { name: p.name, profilePath: p.profile_path },
    });
  }
}

function collectPeople(refs: TmdbPersonRef[]): Map<number, TmdbPersonRef> {
  const m = new Map<number, TmdbPersonRef>();
  for (const r of refs) if (!m.has(r.id)) m.set(r.id, r);
  return m;
}

function aggregateToInputs(
  agg: TmdbAggregateCredits,
  scope: { showId: number; seasonId: number | null },
): { rows: CreditInput[]; people: Map<number, TmdbPersonRef> } {
  const rows: CreditInput[] = [];
  const refs: TmdbPersonRef[] = [];
  for (const c of agg.cast) {
    refs.push(c);
    for (const role of c.roles) {
      rows.push({
        personId: c.id,
        ...scope,
        episodeId: null,
        kind: CREDIT_KIND.CAST,
        character: role.character || null,
        job: null,
        department: null,
        order: c.order,
        episodeCount: role.episode_count,
      });
    }
  }
  for (const c of agg.crew) {
    const jobs = c.jobs.filter((j) => isKeyCrew(c.department, j.job));
    if (jobs.length === 0) continue;
    refs.push(c);
    for (const j of jobs) {
      rows.push({
        personId: c.id,
        ...scope,
        episodeId: null,
        kind: CREDIT_KIND.CREW,
        character: null,
        job: j.job,
        department: c.department,
        order: null,
        episodeCount: j.episode_count,
      });
    }
  }
  return { rows, people: collectPeople(refs) };
}

const withPerson = { person: true } as const;

function scopeWhere(showId: number, seasonId: number | null, episodeId: number | null) {
  return { showId, seasonId, episodeId };
}

async function replaceScope(
  where: ReturnType<typeof scopeWhere>,
  rows: CreditInput[],
  people: Map<number, TmdbPersonRef>,
  stamp: () => Promise<unknown>,
) {
  await upsertPersonStubs(people);
  await prisma.$transaction([
    prisma.credit.deleteMany({ where }),
    ...(rows.length ? [prisma.credit.createMany({ data: rows })] : []),
  ]);
  await stamp();
}

function loadScope(where: ReturnType<typeof scopeWhere>) {
  return prisma.credit.findMany({ where, include: withPerson, orderBy: [{ order: "asc" }, { id: "asc" }] });
}

// ---------- show / season / episode ----------

export async function ensureShowCredits(showId: number): Promise<CreditWithPerson[]> {
  const show = await ensureShow(showId);
  if (!show) return [];
  const where = scopeWhere(showId, null, null);
  if (!isStale(show.creditsFetchedAt)) return loadScope(where);

  let agg: TmdbAggregateCredits;
  let creators: TmdbPersonRef[] = [];
  try {
    [agg, creators] = await Promise.all([
      getShowAggregateCredits(showId),
      getShow(showId).then((d) => d.created_by ?? []), // served from Next's fetch cache
    ]);
  } catch (err) {
    if (show.creditsFetchedAt) return loadScope(where);
    throw err;
  }

  const { rows, people } = aggregateToInputs(agg, { showId, seasonId: null });
  for (const c of creators) {
    people.set(c.id, c);
    rows.unshift({
      personId: c.id,
      showId,
      seasonId: null,
      episodeId: null,
      kind: CREDIT_KIND.CREW,
      character: null,
      job: "Creator",
      department: null,
      order: null,
      episodeCount: show.numberOfEpisodes,
    });
  }
  await replaceScope(where, rows, people, () =>
    prisma.show.update({ where: { id: showId }, data: { creditsFetchedAt: new Date() } }),
  );
  return loadScope(where);
}

export async function ensureSeasonCredits(showId: number, seasonNumber: number): Promise<CreditWithPerson[]> {
  const season = await ensureSeason(showId, seasonNumber);
  if (!season) return [];
  const where = scopeWhere(showId, season.id, null);
  if (!isStale(season.creditsFetchedAt)) return loadScope(where);

  let agg: TmdbAggregateCredits;
  try {
    agg = await getSeasonAggregateCredits(showId, seasonNumber);
  } catch (err) {
    if (season.creditsFetchedAt) return loadScope(where);
    throw err;
  }
  const { rows, people } = aggregateToInputs(agg, { showId, seasonId: season.id });
  await replaceScope(where, rows, people, () =>
    prisma.season.update({ where: { id: season.id }, data: { creditsFetchedAt: new Date() } }),
  );
  return loadScope(where);
}

function episodeToInputs(
  data: TmdbEpisodeCredits,
  ids: { showId: number; seasonId: number; episodeId: number },
): { rows: CreditInput[]; people: Map<number, TmdbPersonRef> } {
  const base = { showId: ids.showId, seasonId: ids.seasonId, episodeId: ids.episodeId, episodeCount: null };
  const rows: CreditInput[] = [];
  const refs: TmdbPersonRef[] = [];
  const addCast = (list: TmdbEpisodeCredits["cast"], kind: string) => {
    for (const c of list) {
      refs.push(c);
      rows.push({ personId: c.id, ...base, kind, character: c.character || null, job: null, department: null, order: c.order });
    }
  };
  addCast(data.cast, CREDIT_KIND.CAST);
  addCast(data.guest_stars ?? [], CREDIT_KIND.GUEST);
  for (const c of data.crew) {
    if (!isKeyCrew(c.department, c.job)) continue;
    refs.push(c);
    rows.push({ personId: c.id, ...base, kind: CREDIT_KIND.CREW, character: null, job: c.job, department: c.department, order: null });
  }
  return { rows, people: collectPeople(refs) };
}

type EpisodeIds = { id: number; showId: number; seasonId: number; seasonNumber: number; episodeNumber: number; creditsFetchedAt: Date | null };

/** Fetches + stores one episode's credits (skips the fetch when fresh). */
async function refreshEpisodeCredits(ep: EpisodeIds, prefetched?: TmdbEpisodeCredits | null) {
  if (!isStale(ep.creditsFetchedAt)) return;
  let data = prefetched;
  if (data === undefined) {
    try {
      data = await getEpisodeCredits(ep.showId, ep.seasonNumber, ep.episodeNumber);
    } catch (err) {
      if (err instanceof TmdbError && err.status === 404) data = null;
      else throw err;
    }
  }
  if (data == null) return;
  const { rows, people } = episodeToInputs(data, { showId: ep.showId, seasonId: ep.seasonId, episodeId: ep.id });
  await replaceScope(scopeWhere(ep.showId, ep.seasonId, ep.id), rows, people, () =>
    prisma.episode.update({ where: { id: ep.id }, data: { creditsFetchedAt: new Date() } }),
  );
}

export async function ensureEpisodeCredits(
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<CreditWithPerson[]> {
  const ep = await ensureEpisode(showId, seasonNumber, episodeNumber);
  if (!ep) return [];
  try {
    await refreshEpisodeCredits(ep);
  } catch (err) {
    if (!ep.creditsFetchedAt) throw err; // otherwise serve the stale cache
  }
  return loadScope(scopeWhere(showId, ep.seasonId, ep.id));
}

// ---------- scans (every episode of a show / season) ----------

async function scanEpisodes(episodes: EpisodeIds[]) {
  const pending = episodes.filter((e) => isStale(e.creditsFetchedAt));
  for (let i = 0; i < pending.length; i += SCAN_BATCH) {
    const batch = pending.slice(i, i + SCAN_BATCH);
    // TMDB calls in parallel, DB writes in sequence.
    const fetched = await Promise.all(
      batch.map((e) =>
        getEpisodeCredits(e.showId, e.seasonNumber, e.episodeNumber).catch((err) => {
          if (err instanceof TmdbError && err.status === 404) return null;
          throw err;
        }),
      ),
    );
    for (let j = 0; j < batch.length; j++) await refreshEpisodeCredits(batch[j], fetched[j]);
  }
}

export async function scanSeasonEpisodeCredits(showId: number, seasonNumber: number) {
  const season = await ensureSeason(showId, seasonNumber);
  if (!season) return 0;
  await scanEpisodes(season.episodes);
  await prisma.season.update({ where: { id: season.id }, data: { episodeCreditsScannedAt: new Date() } });
  return season.episodes.length;
}

export async function scanShowEpisodeCredits(showId: number) {
  const show = await ensureShow(showId);
  if (!show) return 0;
  let count = 0;
  for (const s of show.seasons) count += await scanSeasonEpisodeCredits(showId, s.seasonNumber);
  await prisma.show.update({ where: { id: showId }, data: { episodeCreditsScannedAt: new Date() } });
  return count;
}

// ---------- people ----------

export async function ensurePerson(personId: number): Promise<Person | null> {
  const existing = await prisma.person.findUnique({ where: { id: personId } });
  if (existing && !isStale(existing.fetchedAt)) return existing;

  let detail;
  try {
    detail = await getPerson(personId);
  } catch (err) {
    if (existing) return existing;
    if (err instanceof TmdbError && err.status === 404) return null;
    throw err;
  }
  const data = {
    name: detail.name,
    profilePath: detail.profile_path,
    knownForDepartment: detail.known_for_department,
    biography: detail.biography || null,
    birthday: detail.birthday,
    deathday: detail.deathday,
    placeOfBirth: detail.place_of_birth,
    fetchedAt: new Date(),
  };
  return prisma.person.upsert({ where: { id: personId }, create: { id: personId, ...data }, update: data });
}

/** Caches /person/{id}/tv_credits (cast + key crew) and returns the rows. */
export async function ensurePersonFilmography(person: Person): Promise<PersonTvCredit[]> {
  if (!isStale(person.filmographyFetchedAt)) {
    return prisma.personTvCredit.findMany({ where: { personId: person.id } });
  }
  let credits;
  try {
    credits = await getPersonTvCredits(person.id);
  } catch (err) {
    if (person.filmographyFetchedAt) return prisma.personTvCredit.findMany({ where: { personId: person.id } });
    throw err;
  }

  const common = (c: (typeof credits.cast)[number] | (typeof credits.crew)[number]) => ({
    personId: person.id,
    showId: c.id,
    episodeCount: c.episode_count ?? 0,
    showName: c.name,
    posterPath: c.poster_path,
    firstAirDate: c.first_air_date || null,
    tmdbVoteAverage: c.vote_average || null,
    genreIds: (c.genre_ids ?? []).join(","),
  });
  const rows = [
    ...credits.cast.map((c) => ({ ...common(c), kind: CREDIT_KIND.CAST, character: c.character || null, job: null, department: null })),
    ...credits.crew
      .filter((c) => isKeyCrew(c.department, c.job))
      .map((c) => ({ ...common(c), kind: CREDIT_KIND.CREW, character: null, job: c.job, department: c.department })),
  ];

  await prisma.$transaction([
    prisma.personTvCredit.deleteMany({ where: { personId: person.id } }),
    ...(rows.length ? [prisma.personTvCredit.createMany({ data: rows })] : []),
    prisma.person.update({ where: { id: person.id }, data: { filmographyFetchedAt: new Date() } }),
  ]);
  return prisma.personTvCredit.findMany({ where: { personId: person.id } });
}
