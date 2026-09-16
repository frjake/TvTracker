import { describe, expect, it } from "vitest";
import { formatPercent, isValidRating, scoreFrom, tmdbPercent } from "@/lib/ratings";

describe("scoreFrom", () => {
  it("uses the users' average when at least one rating exists", () => {
    expect(scoreFrom(75, 2, 8.4)).toEqual({ value: 75, source: "users", count: 2 });
  });

  it("rounds the users' average to a whole percent", () => {
    expect(scoreFrom(84.6, 3, null)?.value).toBe(85);
  });

  it("falls back to TMDB × 10 when nobody has rated", () => {
    expect(scoreFrom(null, 0, 7.6)).toEqual({ value: 76, source: "tmdb", count: 0 });
  });

  it("returns null when there is neither a user rating nor a TMDB score", () => {
    expect(scoreFrom(null, 0, null)).toBeNull();
    expect(scoreFrom(null, 0, 0)).toBeNull();
  });
});

describe("helpers", () => {
  it("tmdbPercent scales and rounds", () => {
    expect(tmdbPercent(8.35)).toBe(84);
    expect(tmdbPercent(0)).toBeNull();
    expect(tmdbPercent(undefined)).toBeNull();
  });

  it("formatPercent appends the sign", () => {
    expect(formatPercent(85)).toBe("85%");
    expect(formatPercent(84.5)).toBe("85%");
  });

  it("isValidRating accepts only integers 0-100", () => {
    expect(isValidRating(0)).toBe(true);
    expect(isValidRating(100)).toBe(true);
    expect(isValidRating(101)).toBe(false);
    expect(isValidRating(-1)).toBe(false);
    expect(isValidRating(50.5)).toBe(false);
    expect(isValidRating("50")).toBe(false);
  });
});
