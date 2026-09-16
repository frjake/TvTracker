// Pure prev/next helpers for season and episode navigation (tested in tests/navigation.test.ts).

export interface SeasonRef {
  seasonNumber: number;
  episodeCount: number | null;
}

/** Seasons that take part in linear navigation: numbered ≥ 1 with at least one episode, in order. */
export function regularSeasons<T extends SeasonRef>(seasons: T[]): T[] {
  return seasons.filter((s) => s.seasonNumber > 0 && (s.episodeCount ?? 0) > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/**
 * The seasons before and after `current`. Specials (season 0) are outside the chain: they
 * have no neighbours, and season 1 has no previous season even when specials exist.
 */
export function adjacentSeasons<T extends SeasonRef>(seasons: T[], current: number): { prev: T | null; next: T | null } {
  if (current === 0) return { prev: null, next: null };
  const chain = regularSeasons(seasons);
  const idx = chain.findIndex((s) => s.seasonNumber === current);
  if (idx === -1) return { prev: null, next: null };
  return { prev: chain[idx - 1] ?? null, next: chain[idx + 1] ?? null };
}
