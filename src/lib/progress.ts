// Pure "percentage watched" math (no server imports; tested in tests/progress.test.ts).

export interface Progress {
  watched: number;
  total: number;
}

/**
 * 0–100 share watched, rounded DOWN so 100% only appears when every episode is watched
 * (399/400 → 99). Null when the total is unknown or zero.
 */
export function percentWatched(watched: number, total: number | null | undefined): number | null {
  if (total == null || total <= 0) return null;
  return Math.min(100, Math.floor((Math.min(watched, total) / total) * 100));
}

/** Adds up several parts (e.g. every item on a list). Parts with unknown totals are skipped. */
export function sumProgress(parts: (Progress | null | undefined)[]): Progress {
  let watched = 0;
  let total = 0;
  for (const p of parts) {
    if (!p || p.total <= 0) continue;
    watched += Math.min(p.watched, p.total);
    total += p.total;
  }
  return { watched, total };
}

/** Distinct episodes of one show the user has watched, split into regular seasons and specials (season 0). */
export interface ShowWatchCounts {
  regular: number;
  specials: number;
  /** Regular episodes watched that haven't aired yet (included in `regular`). */
  unaired?: number;
}

/**
 * Whole-show progress. TMDB's episode total covers aired regular episodes only, so each watched
 * special — and each upcoming episode watched early — counts toward both sides: 10/10 regular +
 * 1 special → 11/11, and a special watched first → 1/11. Unwatched specials and upcoming
 * episodes never count. `total` is null when TMDB's is unknown.
 */
export function showProgress(counts: ShowWatchCounts | null | undefined, regularTotal: number | null | undefined): { watched: number; total: number | null } {
  const regular = counts?.regular ?? 0;
  const specials = counts?.specials ?? 0;
  const unaired = counts?.unaired ?? 0;
  return { watched: regular + specials, total: regularTotal == null ? null : regularTotal + specials + unaired };
}
