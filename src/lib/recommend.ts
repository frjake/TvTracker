// Pure scoring for the home-page "Recommended for you" section (no server imports;
// unit-tested in tests/recommend.test.ts). Tuning constants live here.

/** Age at which a watch counts half as much as one from today. */
export const HALF_LIFE_DAYS = 30;
/** A show's weight doubles for every this-many rating points above 50 (halves below). */
export const RATING_DOUBLING = 50;
/** How many of the user's recent shows drive the recommendations. */
export const SEED_COUNT = 6;
/** How many recommendations to show. */
export const RESULT_COUNT = 12;

const DAY_MS = 86_400_000;

export interface WatchEvent {
  showId: number;
  at: Date;
}

export interface Seed {
  showId: number;
  weight: number;
}

export interface CandidateShow {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string | null;
}

export interface Recommendation {
  show: CandidateShow;
  score: number;
  /** The seed that contributed most — "Because you watched …". */
  becauseShowId: number;
}

/** 1 for a watch today, 0.5 at one half-life, 0.25 at two, … Future dates count as today. */
export function recencyWeight(at: Date, now: Date): number {
  const days = Math.max(0, (now.getTime() - at.getTime()) / DAY_MS);
  return 0.5 ** (days / HALF_LIFE_DAYS);
}

/** 2^((score − 50) / RATING_DOUBLING): 0 % → ×0.5, 50 % → ×1, 100 % → ×2. Unrated → ×1. */
export function ratingFactor(score: number | null | undefined): number {
  return score == null ? 1 : 2 ** ((score - 50) / RATING_DOUBLING);
}

/**
 * Sums recency-weighted watch events per show, scales by the user's rating of the show,
 * and returns the heaviest `limit` shows.
 */
export function buildSeeds(
  events: WatchEvent[],
  ratings: Map<number, number | null>,
  now: Date,
  limit = SEED_COUNT,
): Seed[] {
  const totals = new Map<number, number>();
  for (const e of events) totals.set(e.showId, (totals.get(e.showId) ?? 0) + recencyWeight(e.at, now));
  return [...totals.entries()]
    .map(([showId, w]) => ({ showId, weight: w * ratingFactor(ratings.get(showId)) }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.showId - b.showId)
    .slice(0, limit);
}

/**
 * Merges each seed's recommendation list: a candidate scores Σ seedWeight / (rank + 1), so a
 * show several recent favourites point at rises. Excluded ids are dropped; ties break by name.
 */
export function mergeCandidates(
  lists: { seed: Seed; results: CandidateShow[] }[],
  exclude: Set<number>,
  limit = RESULT_COUNT,
): Recommendation[] {
  const byId = new Map<number, Recommendation & { best: number }>();
  for (const { seed, results } of lists) {
    results.forEach((show, rank) => {
      if (exclude.has(show.id)) return;
      const contribution = seed.weight / (rank + 1);
      const existing = byId.get(show.id);
      if (!existing) {
        byId.set(show.id, { show, score: contribution, becauseShowId: seed.showId, best: contribution });
      } else {
        existing.score += contribution;
        if (contribution > existing.best) {
          existing.best = contribution;
          existing.becauseShowId = seed.showId;
        }
      }
    });
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.show.name.localeCompare(b.show.name))
    .slice(0, limit)
    .map(({ show, score, becauseShowId }) => ({ show, score, becauseShowId }));
}
