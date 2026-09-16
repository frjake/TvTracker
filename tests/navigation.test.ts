import { describe, expect, it } from "vitest";
import { adjacentSeasons, regularSeasons } from "@/lib/navigation";

const seasons = [
  { seasonNumber: 0, episodeCount: 1 },
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 12 },
  { seasonNumber: 3, episodeCount: 0 }, // announced, no episodes yet
  { seasonNumber: 4, episodeCount: 8 },
];

describe("regularSeasons", () => {
  it("drops specials and empty seasons, keeps order", () => {
    expect(regularSeasons([...seasons].reverse()).map((s) => s.seasonNumber)).toEqual([1, 2, 4]);
  });
});

describe("adjacentSeasons", () => {
  it("season 1 has no previous season even when specials exist", () => {
    expect(adjacentSeasons(seasons, 1)).toEqual({ prev: null, next: seasons[2] });
  });
  it("skips seasons without episodes", () => {
    expect(adjacentSeasons(seasons, 2)).toEqual({ prev: seasons[1], next: seasons[4] });
    expect(adjacentSeasons(seasons, 4)).toEqual({ prev: seasons[2], next: null });
  });
  it("specials have no neighbours", () => {
    expect(adjacentSeasons(seasons, 0)).toEqual({ prev: null, next: null });
  });
  it("unknown season has no neighbours", () => {
    expect(adjacentSeasons(seasons, 9)).toEqual({ prev: null, next: null });
  });
});
