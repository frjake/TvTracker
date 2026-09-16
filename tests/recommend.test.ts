import { describe, expect, it } from "vitest";
import {
  type CandidateShow,
  HALF_LIFE_DAYS,
  buildSeeds,
  mergeCandidates,
  ratingFactor,
  recencyWeight,
} from "@/lib/recommend";

const now = new Date(2026, 8, 16, 12, 0, 0);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const c = (id: number, name = `Show ${id}`): CandidateShow => ({ id, name, poster_path: null, first_air_date: null });

describe("recencyWeight", () => {
  it("is 1 today, halves every half-life, never exceeds 1", () => {
    expect(recencyWeight(now, now)).toBe(1);
    expect(recencyWeight(daysAgo(HALF_LIFE_DAYS), now)).toBeCloseTo(0.5);
    expect(recencyWeight(daysAgo(2 * HALF_LIFE_DAYS), now)).toBeCloseTo(0.25);
    expect(recencyWeight(daysAgo(-3), now)).toBe(1);
  });
});

describe("ratingFactor", () => {
  it("doubles every 50 points and treats unrated as neutral", () => {
    expect(ratingFactor(0)).toBeCloseTo(0.5);
    expect(ratingFactor(50)).toBe(1);
    expect(ratingFactor(100)).toBeCloseTo(2);
    expect(ratingFactor(75)).toBeCloseTo(Math.SQRT2);
    expect(ratingFactor(null)).toBe(1);
    expect(ratingFactor(undefined)).toBe(1);
  });
});

describe("buildSeeds", () => {
  it("favours recent volume and scales by rating", () => {
    const events = [
      // show 1: three episodes this week
      { showId: 1, at: daysAgo(1) },
      { showId: 1, at: daysAgo(2) },
      { showId: 1, at: daysAgo(3) },
      // show 2: ten episodes three months ago
      ...Array.from({ length: 10 }, () => ({ showId: 2, at: daysAgo(90) })),
      // show 3: one episode today, loved
      { showId: 3, at: daysAgo(0) },
    ];
    const seeds = buildSeeds(events, new Map([[3, 100]]), now);
    expect(seeds.map((s) => s.showId)).toEqual([1, 3, 2]);
    expect(seeds[0].weight).toBeGreaterThan(2.5);
    expect(seeds[1].weight).toBeCloseTo(2); // 1 × ratingFactor(100)
    expect(seeds[2].weight).toBeCloseTo(10 * 0.125, 3);
  });

  it("caps the number of seeds", () => {
    const events = Array.from({ length: 10 }, (_, i) => ({ showId: i + 1, at: daysAgo(i) }));
    expect(buildSeeds(events, new Map(), now, 3).map((s) => s.showId)).toEqual([1, 2, 3]);
  });

  it("returns nothing for no events", () => {
    expect(buildSeeds([], new Map(), now)).toEqual([]);
  });
});

describe("mergeCandidates", () => {
  const seedA = { showId: 100, weight: 2 };
  const seedB = { showId: 200, weight: 1 };

  it("sums contributions across seeds and ranks by total", () => {
    const out = mergeCandidates(
      [
        { seed: seedA, results: [c(1), c(2), c(3)] },
        { seed: seedB, results: [c(3), c(2)] },
      ],
      new Set(),
    );
    // 1: 2/1 = 2 ; 2: 2/2 + 1/2 = 1.5 ; 3: 2/3 + 1/1 ≈ 1.67
    expect(out.map((r) => r.show.id)).toEqual([1, 3, 2]);
  });

  it("attributes each recommendation to the seed that contributed most", () => {
    const out = mergeCandidates(
      [
        { seed: seedA, results: [c(9), c(8), c(3)] },
        { seed: seedB, results: [c(3)] },
      ],
      new Set(),
    );
    const three = out.find((r) => r.show.id === 3)!;
    expect(three.becauseShowId).toBe(200); // 1/1 from B beats 2/3 from A
    expect(out.find((r) => r.show.id === 9)!.becauseShowId).toBe(100);
  });

  it("drops excluded shows and respects the limit", () => {
    const out = mergeCandidates([{ seed: seedA, results: [c(1), c(2), c(3), c(4)] }], new Set([2]), 2);
    expect(out.map((r) => r.show.id)).toEqual([1, 3]);
  });
});
