import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { type Score, scoreFrom } from "./ratings";

export async function episodeScore(
  episodeId: number,
  tmdbVoteAverage: number | null | undefined,
): Promise<Score | null> {
  const agg = await prisma.rating.aggregate({
    where: { episodeId },
    _avg: { value: true },
    _count: { value: true },
  });
  return scoreFrom(agg._avg.value, agg._count.value, tmdbVoteAverage);
}

export async function seasonScore(
  seasonId: number,
  tmdbVoteAverage: number | null | undefined,
): Promise<Score | null> {
  const agg = await prisma.rating.aggregate({
    where: { seasonId },
    _avg: { value: true },
    _count: { value: true },
  });
  return scoreFrom(agg._avg.value, agg._count.value, tmdbVoteAverage);
}

/** Community averages for every rated episode in a season, keyed by episode id. */
export async function episodeAveragesForSeason(seasonId: number) {
  const rows = await prisma.rating.groupBy({
    by: ["episodeId"],
    where: { episode: { seasonId } },
    _avg: { value: true },
    _count: { value: true },
  });
  const map = new Map<number, { average: number | null; count: number }>();
  for (const r of rows) {
    if (r.episodeId != null) map.set(r.episodeId, { average: r._avg.value, count: r._count.value });
  }
  return map;
}

/** Community averages for every rated season of a show, keyed by season id. */
export async function seasonAveragesForShow(showId: number) {
  const rows = await prisma.rating.groupBy({
    by: ["seasonId"],
    where: { season: { showId } },
    _avg: { value: true },
    _count: { value: true },
  });
  const map = new Map<number, { average: number | null; count: number }>();
  for (const r of rows) {
    if (r.seasonId != null) map.set(r.seasonId, { average: r._avg.value, count: r._count.value });
  }
  return map;
}

// ---------- show-level (derived from episode ratings) ----------


type Agg = { average: number | null; count: number };

function toMap(rows: { showId: number | bigint; average: number | null; count: number | bigint }[]) {
  const map = new Map<number, Agg>();
  for (const r of rows) map.set(Number(r.showId), { average: r.average, count: Number(r.count) });
  return map;
}

/** Mean of ALL users' episode ratings per show. */
export async function showAveragesFor(showIds: number[]): Promise<Map<number, Agg>> {
  if (showIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ showId: number; average: number | null; count: number }[]>`
    SELECT e.showId AS showId, AVG(r.value) AS average, COUNT(*) AS count
    FROM Rating r JOIN Episode e ON e.id = r.episodeId
    WHERE e.showId IN (${Prisma.join(showIds)})
    GROUP BY e.showId`;
  return toMap(rows);
}

/** Mean of ONE user's episode ratings per show. */
export async function userShowAveragesFor(userId: string, showIds: number[]): Promise<Map<number, Agg>> {
  if (showIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ showId: number; average: number | null; count: number }[]>`
    SELECT e.showId AS showId, AVG(r.value) AS average, COUNT(*) AS count
    FROM Rating r JOIN Episode e ON e.id = r.episodeId
    WHERE r.userId = ${userId} AND e.showId IN (${Prisma.join(showIds)})
    GROUP BY e.showId`;
  return toMap(rows);
}

/** Distinct episodes the user has watched (marked OR logged) per show. */
export async function watchedCountsFor(userId: string, showIds: number[]): Promise<Map<number, number>> {
  if (showIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ showId: number; count: number }[]>`
    SELECT e.showId AS showId, COUNT(*) AS count
    FROM Episode e
    WHERE e.showId IN (${Prisma.join(showIds)})
      AND (e.id IN (SELECT episodeId FROM WatchedMark WHERE userId = ${userId})
        OR e.id IN (SELECT episodeId FROM LogEntry WHERE userId = ${userId}))
    GROUP BY e.showId`;
  return new Map(rows.map((r) => [Number(r.showId), Number(r.count)]));
}

/** Community score for a whole show: users' episode-rating mean, else TMDB. */
export async function showScore(showId: number, tmdbVoteAverage: number | null | undefined): Promise<Score | null> {
  const agg = (await showAveragesFor([showId])).get(showId);
  return scoreFrom(agg?.average, agg?.count ?? 0, tmdbVoteAverage);
}

/**
 * Per-season watched/total for the user. `total` counts cached Episode rows; callers fall
 * back to Season.episodeCount when a season's episodes haven't been fetched yet.
 */
export async function seasonWatchedCountsFor(
  userId: string,
  seasonIds: number[],
): Promise<Map<number, { watched: number; total: number }>> {
  if (seasonIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ seasonId: number; watched: number | bigint; total: number | bigint }[]>`
    SELECT e.seasonId AS seasonId,
           COUNT(*) AS total,
           SUM(CASE WHEN e.id IN (SELECT episodeId FROM WatchedMark WHERE userId = ${userId})
                      OR e.id IN (SELECT episodeId FROM LogEntry WHERE userId = ${userId})
                    THEN 1 ELSE 0 END) AS watched
    FROM Episode e
    WHERE e.seasonId IN (${Prisma.join(seasonIds)})
    GROUP BY e.seasonId`;
  return new Map(rows.map((r) => [Number(r.seasonId), { watched: Number(r.watched), total: Number(r.total) }]));
}

/** Episode ids (from the given set) the user has marked or logged. */
export async function watchedEpisodeIds(userId: string, episodeIds: number[]): Promise<Set<number>> {
  if (episodeIds.length === 0) return new Set();
  const [marks, logs] = await Promise.all([
    prisma.watchedMark.findMany({ where: { userId, episodeId: { in: episodeIds } }, select: { episodeId: true } }),
    prisma.logEntry.findMany({ where: { userId, episodeId: { in: episodeIds } }, select: { episodeId: true }, distinct: ["episodeId"] }),
  ]);
  return new Set([...marks.map((m) => m.episodeId), ...logs.map((l) => l.episodeId)]);
}
