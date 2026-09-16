import { describe, expect, it } from "vitest";
import { percentWatched, sumProgress } from "@/lib/progress";

describe("percentWatched", () => {
  it("rounds and clamps", () => {
    expect(percentWatched(7, 10)).toBe(70);
    expect(percentWatched(1, 3)).toBe(33);
    expect(percentWatched(2, 3)).toBe(67);
    expect(percentWatched(12, 10)).toBe(100); // specials watched beyond TMDB's count
    expect(percentWatched(0, 10)).toBe(0);
  });
  it("is null when the total is unknown", () => {
    expect(percentWatched(3, null)).toBeNull();
    expect(percentWatched(3, 0)).toBeNull();
  });
});

describe("sumProgress", () => {
  it("adds parts and skips unknown totals", () => {
    expect(sumProgress([{ watched: 1, total: 1 }, { watched: 4, total: 10 }, null, { watched: 2, total: 0 }])).toEqual({ watched: 5, total: 11 });
  });
  it("caps each part at its own total", () => {
    expect(sumProgress([{ watched: 15, total: 10 }])).toEqual({ watched: 10, total: 10 });
  });
});
