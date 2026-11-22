import { describe, expect, it } from "vitest";
import { percentWatched, showProgress, sumProgress } from "@/lib/progress";

describe("percentWatched", () => {
  it("rounds down and clamps", () => {
    expect(percentWatched(7, 10)).toBe(70);
    expect(percentWatched(1, 3)).toBe(33);
    expect(percentWatched(2, 3)).toBe(66);
    expect(percentWatched(1, 8)).toBe(12);
    expect(percentWatched(12, 10)).toBe(100); // specials watched beyond TMDB's count
    expect(percentWatched(0, 10)).toBe(0);
  });
  it("never shows 100% until everything is watched", () => {
    expect(percentWatched(399, 400)).toBe(99);
    expect(percentWatched(400, 400)).toBe(100);
    expect(percentWatched(1, 400)).toBe(0); // the label still says "0% watched", not "Not started"
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

describe("showProgress", () => {
  it("adds watched specials to both sides", () => {
    expect(showProgress({ regular: 10, specials: 0 }, 10)).toEqual({ watched: 10, total: 10 });
    expect(showProgress({ regular: 10, specials: 1 }, 10)).toEqual({ watched: 11, total: 11 });
  });
  it("works when the special is watched first", () => {
    expect(showProgress({ regular: 0, specials: 1 }, 10)).toEqual({ watched: 1, total: 11 });
    expect(percentWatched(1, 11)).toBe(9);
  });
  it("never counts unwatched specials and treats a missing row as nothing watched", () => {
    expect(showProgress({ regular: 4, specials: 0 }, 10)).toEqual({ watched: 4, total: 10 });
    expect(showProgress(undefined, 10)).toEqual({ watched: 0, total: 10 });
  });
  it("counts an upcoming episode watched early on both sides", () => {
    expect(showProgress({ regular: 33, specials: 0, unaired: 1 }, 32)).toEqual({ watched: 33, total: 33 });
    expect(showProgress({ regular: 32, specials: 0, unaired: 0 }, 32)).toEqual({ watched: 32, total: 32 });
  });
  it("keeps the total unknown when TMDB's is", () => {
    expect(showProgress({ regular: 2, specials: 1 }, null)).toEqual({ watched: 3, total: null });
  });
});
