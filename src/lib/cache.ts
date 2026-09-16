import "server-only";

import type { Episode, Season, Show } from "@/generated/prisma/client";
import { TMDB_CACHE_TTL_MS } from "./constants";
import { prisma } from "./db";
import { TmdbError, getSeason, getShow } from "./tmdb";

// Every mutation that references a show/season/episode calls one of these first so the
// row exists (and is reasonably fresh) before we attach user data to it.

export type ShowWithSeasons = Show & { seasons: Season[] };
export type SeasonWithEpisodes = Season & { episodes: Episode[]; show: Show };

function isStale(fetchedAt: Date | null | undefined) {
  return !fetchedAt || Date.now() - fetchedAt.getTime() > TMDB_CACHE_TTL_MS;
}

export async function ensureShow(showId: number): Promise<ShowWithSeasons | null> {
  const existing = await prisma.show.findUnique({
    where: { id: showId },
    include: { seasons: { orderBy: { seasonNumber: "asc" } } },
  });
  if (existing && !isStale(existing.fetchedAt)) return existing;

  let detail;
  try {
    detail = await getShow(showId);
  } catch (err) {
    if (existing) return existing; // serve stale data rather than fail
    if (err instanceof TmdbError && err.status === 404) return null;
    throw err;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.show.upsert({
      where: { id: showId },
      create: {
        id: showId,
        name: detail.name,
        overview: detail.overview || null,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        firstAirDate: detail.first_air_date || null,
        status: detail.status,
        numberOfSeasons: detail.number_of_seasons,
        tmdbVoteAverage: detail.vote_average,
        fetchedAt: now,
      },
      update: {
        name: detail.name,
        overview: detail.overview || null,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        firstAirDate: detail.first_air_date || null,
        status: detail.status,
        numberOfSeasons: detail.number_of_seasons,
        tmdbVoteAverage: detail.vote_average,
        fetchedAt: now,
      },
    }),
    ...detail.seasons.map((s) =>
      prisma.season.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          showId,
          seasonNumber: s.season_number,
          name: s.name,
          overview: s.overview || null,
          posterPath: s.poster_path,
          airDate: s.air_date,
          episodeCount: s.episode_count,
          tmdbVoteAverage: s.vote_average ?? null,
          fetchedAt: now,
        },
        // Deliberately leaves episodesFetchedAt untouched.
        update: {
          seasonNumber: s.season_number,
          name: s.name,
          overview: s.overview || null,
          posterPath: s.poster_path,
          airDate: s.air_date,
          episodeCount: s.episode_count,
          tmdbVoteAverage: s.vote_average ?? null,
          fetchedAt: now,
        },
      }),
    ),
  ]);

  return prisma.show.findUniqueOrThrow({
    where: { id: showId },
    include: { seasons: { orderBy: { seasonNumber: "asc" } } },
  });
}

export async function ensureSeason(
  showId: number,
  seasonNumber: number,
): Promise<SeasonWithEpisodes | null> {
  const show = await ensureShow(showId);
  if (!show) return null;

  const include = { show: true, episodes: { orderBy: { episodeNumber: "asc" as const } } };
  const existing = await prisma.season.findUnique({
    where: { showId_seasonNumber: { showId, seasonNumber } },
    include,
  });
  if (existing?.episodesFetchedAt && !isStale(existing.episodesFetchedAt)) return existing;

  let detail;
  try {
    detail = await getSeason(showId, seasonNumber);
  } catch (err) {
    if (existing?.episodesFetchedAt) return existing;
    if (err instanceof TmdbError && err.status === 404) return null;
    throw err;
  }

  const now = new Date();
  const seasonData = {
    showId,
    seasonNumber: detail.season_number,
    name: detail.name,
    overview: detail.overview || null,
    posterPath: detail.poster_path,
    airDate: detail.air_date,
    episodeCount: detail.episodes.length,
    tmdbVoteAverage: detail.vote_average ?? null,
    fetchedAt: now,
    episodesFetchedAt: now,
  };
  await prisma.$transaction([
    prisma.season.upsert({
      where: { id: detail.id },
      create: { id: detail.id, ...seasonData },
      update: seasonData,
    }),
    ...detail.episodes.map((e) => {
      const data = {
        showId,
        seasonId: detail.id,
        seasonNumber: e.season_number,
        episodeNumber: e.episode_number,
        name: e.name,
        overview: e.overview || null,
        stillPath: e.still_path,
        airDate: e.air_date,
        runtime: e.runtime,
        tmdbVoteAverage: e.vote_average,
        fetchedAt: now,
      };
      return prisma.episode.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
    }),
  ]);

  return prisma.season.findUniqueOrThrow({ where: { id: detail.id }, include });
}

export async function ensureEpisode(
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<(Episode & { season: SeasonWithEpisodes }) | null> {
  const season = await ensureSeason(showId, seasonNumber);
  const episode = season?.episodes.find((e) => e.episodeNumber === episodeNumber);
  return episode && season ? { ...episode, season } : null;
}
