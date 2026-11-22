import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { todayString } from "./dates";
import { prisma } from "./db";
import type { ShowWatchCounts } from "./progress";
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

/**
 * SQL mirror of src/lib/airing.ts for an Episode aliased `e`, its Season `se` and Show `sh`:
 * dated episodes have aired once their date arrives; undated ones when their season has started
 * (season date, any dated episode, or — for specials — the show's first air date).
 */
function airedSql(today: string) {
  return Prisma.sql`(CASE WHEN e.airDate IS NOT NULL THEN e.airDate <= ${today}
    ELSE ((se.airDate IS NOT NULL AND se.airDate <= ${today})
      OR EXISTS (SELECT 1 FROM Episode x WHERE x.seasonId = e.seasonId AND x.airDate IS NOT NULL AND x.airDate <= ${today})
      OR (e.seasonNumber = 0 AND sh.firstAirDate IS NOT NULL AND sh.firstAirDate <= ${today})) END)`;
}

function watchedSql(userId: string) {
  return Prisma.sql`(e.id IN (SELECT episodeId FROM WatchedMark WHERE userId = ${userId})
    OR e.id IN (SELECT episodeId FROM LogEntry WHERE userId = ${userId}))`;
}

/** Distinct episodes the user has watched (marked OR logged) per show, specials counted separately. */
export async function watchedCountsFor(userId: string, showIds: number[]): Promise<Map<number, ShowWatchCounts>> {
  if (showIds.length === 0) return new Map();
  const aired = airedSql(todayString());
  const rows = await prisma.$queryRaw<{ showId: number; regular: number | bigint; specials: number | bigint; unaired: number | bigint }[]>`
    SELECT e.showId AS showId,
           SUM(CASE WHEN e.seasonNumber = 0 THEN 0 ELSE 1 END) AS regular,
           SUM(CASE WHEN e.seasonNumber = 0 THEN 1 ELSE 0 END) AS specials,
           SUM(CASE WHEN e.seasonNumber <> 0 AND NOT ${aired} THEN 1 ELSE 0 END) AS unaired
    FROM Episode e JOIN Season se ON se.id = e.seasonId JOIN Show sh ON sh.id = e.showId
    WHERE e.showId IN (${Prisma.join(showIds)}) AND ${watchedSql(userId)}
    GROUP BY e.showId`;
  return new Map(
    rows.map((r) => [Number(r.showId), { regular: Number(r.regular), specials: Number(r.specials), unaired: Number(r.unaired) }]),
  );
}

/** Community score for a whole show: users' episode-rating mean, else TMDB. */
export async function showScore(showId: number, tmdbVoteAverage: number | null | undefined): Promise<Score | null> {
  const agg = (await showAveragesFor([showId])).get(showId);
  return scoreFrom(agg?.average, agg?.count ?? 0, tmdbVoteAverage);
}

/**
 * Per-season watched/total for the user, counting only aired episodes (plus upcoming ones already
 * watched). Callers fall back to uncachedSeasonTotal when a season's episodes aren't cached yet.
 */
export async function seasonWatchedCountsFor(
  userId: string,
  seasonIds: number[],
): Promise<Map<number, { watched: number; total: number }>> {
  if (seasonIds.length === 0) return new Map();
  // Total = aired episodes + any upcoming ones already watched (see seasonProgress in airing.ts).
  const watched = watchedSql(userId);
  const rows = await prisma.$queryRaw<{ seasonId: number; watched: number | bigint; total: number | bigint }[]>`
    SELECT e.seasonId AS seasonId,
           SUM(CASE WHEN ${airedSql(todayString())} OR ${watched} THEN 1 ELSE 0 END) AS total,
           SUM(CASE WHEN ${watched} THEN 1 ELSE 0 END) AS watched
    FROM Episode e JOIN Season se ON se.id = e.seasonId JOIN Show sh ON sh.id = e.showId
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
