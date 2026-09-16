import "server-only";

// Thin, typed wrapper over the TMDB v3 API. Server-only: the key never reaches the client.

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

export function imageUrl(path: string | null | undefined, size: ImageSize = "w342"): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

// ---------- Response shapes (only the fields we use) ----------

export interface TmdbShowSummary {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
  vote_average?: number;
}

export interface TmdbShowDetail extends TmdbShowSummary {
  status: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeasonSummary[];
}

export interface TmdbEpisode {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface TmdbSeasonDetail extends TmdbSeasonSummary {
  episodes: TmdbEpisode[];
}

export interface TmdbPage<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

// ---------- Auth + fetch ----------

function credentials(): { headers: Record<string, string>; params: Record<string, string> } {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (token) return { headers: { Authorization: `Bearer ${token}` }, params: {} };
  const key = process.env.TMDB_API_KEY;
  if (key) return { headers: {}, params: { api_key: key } };
  throw new Error(
    "TMDB credentials missing. Set TMDB_API_KEY (v3 key) or TMDB_ACCESS_TOKEN (v4 token) in .env.",
  );
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  revalidateSeconds = 3600,
): Promise<T> {
  const { headers, params: authParams } = credentials();
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries({ ...authParams, ...params })) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    throw new TmdbError(`TMDB ${res.status} for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

// ---------- Endpoints ----------

export function searchTv(query: string, page = 1) {
  return tmdbFetch<TmdbPage<TmdbShowSummary>>("/search/tv", {
    query,
    page: String(page),
    include_adult: "false",
  });
}

export function trendingTv() {
  return tmdbFetch<TmdbPage<TmdbShowSummary>>("/trending/tv/week", {}, 6 * 3600);
}

export function getShow(showId: number) {
  return tmdbFetch<TmdbShowDetail>(`/tv/${showId}`);
}

export function getSeason(showId: number, seasonNumber: number) {
  return tmdbFetch<TmdbSeasonDetail>(`/tv/${showId}/season/${seasonNumber}`);
}
