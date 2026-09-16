// Pure "percentage watched" math (no server imports; tested in tests/progress.test.ts).

export interface Progress {
  watched: number;
  total: number;
}

/** 0–100 (rounded, clamped) share watched; null when the total is unknown or zero. */
export function percentWatched(watched: number, total: number | null | undefined): number | null {
  if (total == null || total <= 0) return null;
  return Math.min(100, Math.round((Math.min(watched, total) / total) * 100));
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
