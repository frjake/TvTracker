import "server-only";

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
