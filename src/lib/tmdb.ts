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

export interface TmdbPersonRef {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface TmdbShowDetail extends TmdbShowSummary {
  status: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeasonSummary[];
  created_by: TmdbPersonRef[];
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

// ---------- Credits & people ----------

export interface TmdbAggregateCast extends TmdbPersonRef {
  order: number;
  total_episode_count: number;
  roles: { credit_id: string; character: string; episode_count: number }[];
}

export interface TmdbAggregateCrew extends TmdbPersonRef {
  department: string;
  total_episode_count: number;
  jobs: { credit_id: string; job: string; episode_count: number }[];
}

export interface TmdbAggregateCredits {
  cast: TmdbAggregateCast[];
  crew: TmdbAggregateCrew[];
}

export interface TmdbEpisodeCast extends TmdbPersonRef {
  character: string;
  order: number;
}

export interface TmdbEpisodeCrew extends TmdbPersonRef {
  job: string;
  department: string;
}

export interface TmdbEpisodeCredits {
  cast: TmdbEpisodeCast[];
  guest_stars: TmdbEpisodeCast[];
  crew: TmdbEpisodeCrew[];
}

export interface TmdbPersonDetail extends TmdbPersonRef {
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string | null;
}

interface TmdbPersonTvCreditBase {
  id: number; // show id
  name: string;
  poster_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  genre_ids: number[];
  episode_count: number;
  credit_id: string;
}

export interface TmdbPersonTvCastCredit extends TmdbPersonTvCreditBase {
  character: string;
}

export interface TmdbPersonTvCrewCredit extends TmdbPersonTvCreditBase {
  job: string;
  department: string;
}

export interface TmdbPersonTvCredits {
  cast: TmdbPersonTvCastCredit[];
  crew: TmdbPersonTvCrewCredit[];
}

export function getShowAggregateCredits(showId: number) {
  return tmdbFetch<TmdbAggregateCredits>(`/tv/${showId}/aggregate_credits`);
}

export function getSeasonAggregateCredits(showId: number, seasonNumber: number) {
  return tmdbFetch<TmdbAggregateCredits>(`/tv/${showId}/season/${seasonNumber}/aggregate_credits`);
}

export function getEpisodeCredits(showId: number, seasonNumber: number, episodeNumber: number) {
  return tmdbFetch<TmdbEpisodeCredits>(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}/credits`);
}

export function getPerson(personId: number) {
  return tmdbFetch<TmdbPersonDetail>(`/person/${personId}`);
}

export function getPersonTvCredits(personId: number) {
  return tmdbFetch<TmdbPersonTvCredits>(`/person/${personId}/tv_credits`);
}

// ---------- people search ----------

export interface TmdbPersonSummary extends TmdbPersonRef {
  known_for_department: string | null;
  known_for: { id: number; media_type: "tv" | "movie"; name?: string; title?: string; poster_path: string | null }[];
}

export function searchPeople(query: string, page = 1) {
  return tmdbFetch<TmdbPage<TmdbPersonSummary>>("/search/person", {
    query,
    page: String(page),
    include_adult: "false",
  });
}
