import { describe, expect, it } from "vitest";
import { airedEpisodes, isAired, seasonHasStarted, seasonProgress, uncachedSeasonTotal } from "@/lib/airing";

const today = "2026-11-21";

describe("seasonHasStarted", () => {
  it("uses the season date, then any episode date", () => {
    expect(seasonHasStarted({ seasonNumber: 4, airDate: "2026-03-18" }, [], null, today)).toBe(true);
    expect(seasonHasStarted({ seasonNumber: 5, airDate: "2027-02-17" }, ["2027-02-17"], "2021-03-25", today)).toBe(false);
    expect(seasonHasStarted({ seasonNumber: 2, airDate: null }, [null, "2026-01-01"], null, today)).toBe(true);
  });
  it("treats specials as started once the show has", () => {
    expect(seasonHasStarted({ seasonNumber: 0, airDate: null }, [null, null], "1999-10-05", today)).toBe(true);
    expect(seasonHasStarted({ seasonNumber: 0, airDate: null }, [null], "2027-01-01", today)).toBe(false);
  });
  it("an announced regular season with no dates hasn't started", () => {
    expect(seasonHasStarted({ seasonNumber: 2, airDate: null }, [null], "2024-12-05", today)).toBe(false);
  });
});

describe("isAired", () => {
  it("dated episodes air on their date", () => {
    expect(isAired("2026-11-21", false, today)).toBe(true);
    expect(isAired("2026-11-22", true, today)).toBe(false);
  });
  it("undated episodes follow their season", () => {
    expect(isAired(null, true, today)).toBe(true);
    expect(isAired(null, false, today)).toBe(false);
  });
});

const show = { firstAirDate: "2021-03-25" };
const s5 = {
  seasonNumber: 5,
  airDate: "2027-02-17",
  show,
  episodes: [
    { id: 1, airDate: "2027-02-17" },
    { id: 2, airDate: "2027-02-24" },
  ],
};
const s4 = {
  seasonNumber: 4,
  airDate: "2026-11-07",
  show,
  episodes: [
    { id: 11, airDate: "2026-11-07" },
    { id: 12, airDate: "2026-11-14" },
    { id: 13, airDate: "2026-11-28" }, // next week
  ],
};

describe("airedEpisodes / seasonProgress", () => {
  it("skips upcoming episodes", () => {
    expect(airedEpisodes(s5, today)).toEqual([]);
    expect(airedEpisodes(s4, today).map((e) => e.id)).toEqual([11, 12]);
  });
  it("totals only aired episodes, plus any upcoming one already watched", () => {
    expect(seasonProgress(s4, new Set([11]), today)).toEqual({ watched: 1, total: 2, aired: 2 });
    expect(seasonProgress(s4, new Set([11, 12]), today)).toEqual({ watched: 2, total: 2, aired: 2 });
    expect(seasonProgress(s4, new Set([11, 12, 13]), today)).toEqual({ watched: 3, total: 3, aired: 2 });
    expect(seasonProgress(s5, new Set(), today)).toEqual({ watched: 0, total: 0, aired: 0 });
  });
});

describe("uncachedSeasonTotal", () => {
  it("is zero before a season airs and TMDB's count after", () => {
    expect(uncachedSeasonTotal({ airDate: "2027-02-17", episodeCount: 8 }, today)).toBe(0);
    expect(uncachedSeasonTotal({ airDate: "2026-03-18", episodeCount: 8 }, today)).toBe(8);
    expect(uncachedSeasonTotal({ airDate: null, episodeCount: 3 }, today)).toBe(3);
  });
});
