// Pure "has it aired yet?" rules (tested in tests/airing.test.ts). Dates are YYYY-MM-DD strings
// compared as text. The SQL in scores.ts (airedSql) mirrors these rules; keep the two in sync.

export interface AiringSeason {
  seasonNumber: number;
  airDate: string | null;
}

/**
 * A season has started when its own air date, or any of its episodes' air dates, is today or
 * earlier. Specials (season 0) have no meaningful season date, so they've started once the
 * show has.
 */
export function seasonHasStarted(
  season: AiringSeason,
  episodeAirDates: (string | null)[],
  showFirstAirDate: string | null,
  today: string,
): boolean {
  if (season.airDate && season.airDate <= today) return true;
  if (episodeAirDates.some((d) => d != null && d <= today)) return true;
  return season.seasonNumber === 0 && showFirstAirDate != null && showFirstAirDate <= today;
}

/** Dated episodes have aired once their date arrives; undated ones count as aired if their season has started. */
export function isAired(airDate: string | null, seasonStarted: boolean, today: string): boolean {
  return airDate != null ? airDate <= today : seasonStarted;
}

/** The episodes of a (cached) season that have aired, in order. */
export function airedEpisodes<T extends { airDate: string | null }>(
  season: AiringSeason & { episodes: T[]; show: { firstAirDate: string | null } },
  today: string,
): T[] {
  const started = seasonHasStarted(season, season.episodes.map((e) => e.airDate), season.show.firstAirDate, today);
  return season.episodes.filter((e) => isAired(e.airDate, started, today));
}

/**
 * Progress for one season: aired episodes plus any unaired ones already watched (an early
 * screener counts, but upcoming episodes never inflate the total on their own).
 */
export function seasonProgress<T extends { id: number; airDate: string | null }>(
  season: AiringSeason & { episodes: T[]; show: { firstAirDate: string | null } },
  watchedIds: Set<number>,
  today: string,
): { watched: number; total: number; aired: number } {
  const aired = new Set(airedEpisodes(season, today).map((e) => e.id));
  const watched = season.episodes.filter((e) => watchedIds.has(e.id)).length;
  const unairedWatched = season.episodes.filter((e) => watchedIds.has(e.id) && !aired.has(e.id)).length;
  return { watched, total: aired.size + unairedWatched, aired: aired.size };
}

/** Total to show for a season whose episodes aren't cached yet: nothing until it starts airing. */
export function uncachedSeasonTotal(season: { airDate: string | null; episodeCount: number | null }, today: string): number {
  return season.airDate && season.airDate > today ? 0 : (season.episodeCount ?? 0);
}
