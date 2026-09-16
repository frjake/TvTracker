// Pure rating helpers (no server imports so they are unit-testable).

import { RATING_MAX, RATING_MIN } from "./constants";

export interface Score {
  /** 0-100 */
  value: number;
  /** Whose number this is. */
  source: "users" | "tmdb";
  /** Number of TvTracker ratings behind the value (0 when falling back to TMDB). */
  count: number;
}

/**
 * Community score for an item: the users' mean when at least one rating exists,
 * otherwise TMDB's 0-10 vote average scaled to a percentage. Null when neither exists.
 */
export function scoreFrom(
  usersAverage: number | null | undefined,
  usersCount: number,
  tmdbVoteAverage: number | null | undefined,
): Score | null {
  if (usersCount > 0 && usersAverage != null) {
    return { value: Math.round(usersAverage), source: "users", count: usersCount };
  }
  if (tmdbVoteAverage != null && tmdbVoteAverage > 0) {
    return { value: Math.round(tmdbVoteAverage * 10), source: "tmdb", count: 0 };
  }
  return null;
}

/** TMDB's 0-10 average as a percentage, or null. Shown as a secondary number. */
export function tmdbPercent(tmdbVoteAverage: number | null | undefined): number | null {
  return tmdbVoteAverage != null && tmdbVoteAverage > 0 ? Math.round(tmdbVoteAverage * 10) : null;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}
