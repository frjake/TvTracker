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
