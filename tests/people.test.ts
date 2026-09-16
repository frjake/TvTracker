import { describe, expect, it } from "vitest";
import {
  type EpisodeRow,
  type ShowRow,
  activeSortDir,
  coerceYearRange,
  filmographyHref,
  headerSortHref,
  filterEpisodes,
  filterShows,
  groupEpisodeRows,
  groupShowRows,
  isKeyCrew,
  prepareShows,
  parseFilmographyQuery,
  progressFraction,
  progressState,
  sortEpisodes,
  sortShows,
  yearOf,
} from "@/lib/people";

function show(over: Partial<ShowRow>): ShowRow {
  return {
    creditId: over.creditId ?? Math.random().toString(36).slice(2),
    showId: 1,
    name: "Show",
    posterPath: null,
    firstAirDate: "2020-01-01",
    kind: "cast",
    role: "Someone",
    department: null,
    episodeCount: 10,
    genreIds: [18],
    tmdbVoteAverage: 7,
    communityScore: null,
    communityCount: 0,
    yourScore: null,
    billing: null,
    watchedCount: 0,
    totalEpisodes: 10,
    cached: true,
    scanned: false,
    ...over,
  };
}

function episode(over: Partial<EpisodeRow>): EpisodeRow {
  return {
    creditId: over.creditId ?? Math.random().toString(36).slice(2),
    episodeId: 1,
    showId: 1,
    showName: "Show",
    seasonNumber: 1,
    episodeNumber: 1,
    title: "Ep",
    airDate: "2020-01-01",
    kind: "cast",
    role: "Someone",
    billing: null,
    tmdbVoteAverage: 7,
    communityScore: null,
    communityCount: 0,
    yourScore: null,
    watched: false,
    ...over,
  };
}

const defaults = parseFilmographyQuery({});

describe("isKeyCrew", () => {
  it("keeps directors, writers, story/teleplay, creators and EPs", () => {
    expect(isKeyCrew("Directing", "Director")).toBe(true);
    expect(isKeyCrew("Writing", "Writer")).toBe(true);
    expect(isKeyCrew("Writing", "Teleplay")).toBe(true);
    expect(isKeyCrew("Production", "Executive Producer")).toBe(true);
    expect(isKeyCrew(null, "Creator")).toBe(true);
  });
  it("drops support roles even inside Directing/Writing departments", () => {
    expect(isKeyCrew("Directing", "First Assistant Director")).toBe(false);
    expect(isKeyCrew("Writing", "Script Supervisor")).toBe(false);
    expect(isKeyCrew("Writing", "Staff Writer")).toBe(false);
    expect(isKeyCrew("Sound", "Boom Operator")).toBe(false);
    expect(isKeyCrew("Production", "Producer")).toBe(false);
  });
});

describe("progressState / yearOf", () => {
  it("classifies progress", () => {
    expect(progressState(0, 10)).toBe("not_started");
    expect(progressState(3, 10)).toBe("in_progress");
    expect(progressState(10, 10)).toBe("completed");
    expect(progressState(12, 10)).toBe("completed");
    expect(progressState(3, null)).toBe("in_progress"); // unknown total is never completed
  });
  it("extracts years", () => {
    expect(yearOf("2021-05-02")).toBe(2021);
    expect(yearOf("")).toBeNull();
    expect(yearOf(null)).toBeNull();
  });
});

describe("parseFilmographyQuery", () => {
  it("has sensible defaults: newest first, noise and singles hidden", () => {
    expect(defaults).toMatchObject({ sort: "date", dir: "desc", watched: "any", all: false, singles: false, dept: "all" });
  });
  it("derives the default direction from the sort key", () => {
    expect(parseFilmographyQuery({ sort: "name" }).dir).toBe("asc");
    expect(parseFilmographyQuery({ sort: "billing" }).dir).toBe("asc");
    expect(parseFilmographyQuery({ sort: "rating" }).dir).toBe("desc");
    expect(parseFilmographyQuery({ sort: "name", dir: "desc" }).dir).toBe("desc");
  });
  it("ignores junk", () => {
    const q = parseFilmographyQuery({ sort: "bogus", from: "abc", to: "1200", watched: "nope", all: "1" });
    expect(q.sort).toBe("date");
    expect(q.from).toBeNull();
    expect(q.to).toBeNull();
    expect(q.watched).toBe("any");
    expect(q.all).toBe(true);
  });
});

describe("filterShows", () => {
  const drama = show({ showId: 1, name: "Drama", genreIds: [18], episodeCount: 12 });
  const talk = show({ showId: 2, name: "Talk", genreIds: [35, 10767], episodeCount: 1 });
  const cameo = show({ showId: 3, name: "Cameo", genreIds: [18], episodeCount: 1 });
  const crew = show({ showId: 4, name: "Directed", kind: "crew", role: "Director", episodeCount: 3 });

  it("hides talk/news/reality and single-episode credits by default", () => {
    expect(prepareShows([drama, talk, cameo, crew], defaults).map((r) => r.name).sort()).toEqual(["Directed", "Drama"]);
  });
  it("toggles restore them independently", () => {
    expect(prepareShows([drama, talk, cameo], { ...defaults, singles: true }).map((r) => r.name).sort()).toEqual(["Cameo", "Drama"]);
    expect(prepareShows([drama, talk, cameo], { ...defaults, all: true, singles: true }).map((r) => r.name).sort()).toEqual(["Cameo", "Drama", "Talk"]);
  });
  it("groups several credits on one show into a single row", () => {
    const rows = [
      show({ showId: 7, name: "Lasso", kind: "crew", role: "Executive Producer", episodeCount: 44 }),
      show({ showId: 7, name: "Lasso", kind: "cast", role: "Ted", episodeCount: 44 }),
      show({ showId: 7, name: "Lasso", kind: "crew", role: "Writer", episodeCount: 3 }),
      show({ showId: 8, name: "Cameo show", kind: "cast", role: "Guy", episodeCount: 1 }),
      show({ showId: 8, name: "Cameo show", kind: "crew", role: "Executive Producer", episodeCount: 20 }),
    ];
    const grouped = groupShowRows(rows, defaults);
    expect(grouped).toHaveLength(2);
    const lasso = grouped.find((g) => g.showId === 7)!;
    expect(lasso.kind).toBe("cast");
    expect(lasso.role).toBe("Ted, Executive Producer, Writer");
    expect(lasso.episodeCount).toBe(44);
    // the 1-episode cameo survives because the same show has a 20-episode credit
    expect(grouped.find((g) => g.showId === 8)!.episodeCount).toBe(20);
  });
  it("filters by department", () => {
    expect(filterShows([drama, crew], { ...defaults, dept: "crew" }).map((r) => r.name)).toEqual(["Directed"]);
  });
  it("filters by watched state", () => {
    const rows = [
      show({ name: "Fresh", watchedCount: 0 }),
      show({ name: "Midway", watchedCount: 4 }),
      show({ name: "Done", watchedCount: 10 }),
    ];
    expect(filterShows(rows, { ...defaults, watched: "in_progress" }).map((r) => r.name)).toEqual(["Midway"]);
    expect(filterShows(rows, { ...defaults, watched: "completed" }).map((r) => r.name)).toEqual(["Done"]);
    expect(filterShows(rows, { ...defaults, watched: "not_started" }).map((r) => r.name)).toEqual(["Fresh"]);
  });
  it("filters by year range and drops undated rows only when a bound is set", () => {
    const rows = [show({ name: "Old", firstAirDate: "1999-01-01" }), show({ name: "New", firstAirDate: "2022-06-01" }), show({ name: "Undated", firstAirDate: null })];
    expect(filterShows(rows, { ...defaults, from: 2010 }).map((r) => r.name)).toEqual(["New"]);
    expect(filterShows(rows, { ...defaults, to: 2000 }).map((r) => r.name)).toEqual(["Old"]);
    expect(filterShows(rows, defaults)).toHaveLength(3);
  });
});

describe("sortShows", () => {
  const a = show({ name: "A", communityScore: 90, yourScore: null, billing: 2, firstAirDate: "2010-01-01", episodeCount: 5 });
  const b = show({ name: "B", communityScore: null, yourScore: 60, billing: null, firstAirDate: "2020-01-01", episodeCount: 50 });
  const c = show({ name: "C", communityScore: 70, yourScore: 80, billing: 0, firstAirDate: "2015-01-01", episodeCount: 20 });

  it("sorts by date newest first by default", () => {
    expect(sortShows([a, b, c], defaults).map((r) => r.name)).toEqual(["B", "C", "A"]);
  });
  it("puts unrated shows last regardless of direction", () => {
    const desc = parseFilmographyQuery({ sort: "rating" });
    const asc = parseFilmographyQuery({ sort: "rating", dir: "asc" });
    expect(sortShows([a, b, c], desc).map((r) => r.name)).toEqual(["A", "C", "B"]);
    expect(sortShows([a, b, c], asc).map((r) => r.name)).toEqual(["C", "A", "B"]);
  });
  it("sorts by your rating and billing with nulls last", () => {
    expect(sortShows([a, b, c], parseFilmographyQuery({ sort: "myrating" })).map((r) => r.name)).toEqual(["C", "B", "A"]);
    expect(sortShows([a, b, c], parseFilmographyQuery({ sort: "billing" })).map((r) => r.name)).toEqual(["C", "A", "B"]);
  });
  it("sorts by episode count and name", () => {
    expect(sortShows([a, b, c], parseFilmographyQuery({ sort: "episodes" })).map((r) => r.name)).toEqual(["B", "C", "A"]);
    expect(sortShows([c, a, b], parseFilmographyQuery({ sort: "name" })).map((r) => r.name)).toEqual(["A", "B", "C"]);
  });
});

describe("episodes", () => {
  const e1 = episode({ title: "One", airDate: "2020-08-14", yourScore: 85, watched: true, billing: 0, showId: 1 });
  const e2 = episode({ title: "Two", airDate: "2020-08-21", yourScore: null, watched: false, billing: 3, showId: 1, episodeNumber: 2 });
  const e3 = episode({ title: "Other", airDate: "2018-01-01", yourScore: 50, watched: true, billing: 1, showId: 2, showName: "Another" });

  it("filters by watched, show and year", () => {
    expect(filterEpisodes([e1, e2, e3], { ...defaults, ewatched: "watched" }).map((r) => r.title)).toEqual(["One", "Other"]);
    expect(filterEpisodes([e1, e2, e3], { ...defaults, ewatched: "unwatched" }).map((r) => r.title)).toEqual(["Two"]);
    expect(filterEpisodes([e1, e2, e3], { ...defaults, eshow: 2 }).map((r) => r.title)).toEqual(["Other"]);
    expect(filterEpisodes([e1, e2, e3], { ...defaults, efrom: 2020, eto: 2020 }).map((r) => r.title)).toEqual(["One", "Two"]);
  });
  it("sorts by your rating with nulls last, and by billing", () => {
    expect(sortEpisodes([e1, e2, e3], parseFilmographyQuery({ esort: "myrating" })).map((r) => r.title)).toEqual(["One", "Other", "Two"]);
    expect(sortEpisodes([e1, e2, e3], parseFilmographyQuery({ esort: "billing" })).map((r) => r.title)).toEqual(["One", "Other", "Two"]);
  });
  it("groups several credits on one episode into a single row", () => {
    const rows = [
      episode({ episodeId: 9, kind: "crew", role: "Teleplay", billing: null }),
      episode({ episodeId: 9, kind: "cast", role: "Ted Lasso", billing: 0 }),
      episode({ episodeId: 9, kind: "crew", role: "Story", billing: null }),
      episode({ episodeId: 10, kind: "guest", role: "Himself", billing: 4 }),
    ];
    const grouped = groupEpisodeRows(rows);
    expect(grouped).toHaveLength(2);
    const pilot = grouped.find((g) => g.episodeId === 9)!;
    expect(pilot.kind).toBe("cast");
    expect(pilot.role).toBe("Ted Lasso, Teleplay, Story");
    expect(pilot.billing).toBe(0);
    expect(grouped.find((g) => g.episodeId === 10)!.kind).toBe("guest");
  });
  it("default sort is air date, newest first", () => {
    expect(sortEpisodes([e3, e1, e2], defaults).map((r) => r.title)).toEqual(["Two", "One", "Other"]);
  });
});

describe("filmographyHref", () => {
  it("omits defaults and keeps overrides", () => {
    expect(filmographyHref("/person/1", defaults)).toBe("/person/1");
    expect(filmographyHref("/person/1", defaults, { sort: "rating", all: true })).toBe("/person/1?sort=rating&all=1");
    expect(filmographyHref("/person/1", defaults, { sort: "name", dir: "desc" })).toBe("/person/1?sort=name&dir=desc");
  });
});

describe("header sorting", () => {
  it("a new column sorts ascending first", () => {
    expect(headerSortHref("/person/1", defaults, "shows", "name")).toBe("/person/1?sort=name");
    expect(headerSortHref("/person/1", defaults, "shows", "rating")).toBe("/person/1?sort=rating&dir=asc");
  });
  it("clicking the active column cycles asc → desc → asc", () => {
    const asc = parseFilmographyQuery({ sort: "name" });
    expect(headerSortHref("/person/1", asc, "shows", "name")).toBe("/person/1?sort=name&dir=desc");
    const desc = parseFilmographyQuery({ sort: "name", dir: "desc" });
    expect(headerSortHref("/person/1", desc, "shows", "name")).toBe("/person/1?sort=name");
  });
  it("episode headers use the e-prefixed params and keep show params", () => {
    const q = parseFilmographyQuery({ sort: "episodes" });
    expect(headerSortHref("/person/1", q, "episodes", "watched")).toBe("/person/1?sort=episodes&esort=watched&edir=asc");
  });
  it("reports the active direction per column", () => {
    const q = parseFilmographyQuery({ sort: "role", esort: "billing", edir: "desc" });
    expect(activeSortDir(q, "shows", "role")).toBe("asc");
    expect(activeSortDir(q, "shows", "name")).toBeNull();
    expect(activeSortDir(q, "episodes", "billing")).toBe("desc");
  });
  it("sorts shows by role and progress, episodes by role and watched", () => {
    const rows = [
      show({ showId: 1, name: "A", role: "Zed", watchedCount: 5, totalEpisodes: 10 }),
      show({ showId: 2, name: "B", role: "Alpha", watchedCount: 10, totalEpisodes: 10 }),
      show({ showId: 3, name: "C", role: "Mid", watchedCount: 0, totalEpisodes: null }),
    ];
    expect(sortShows(rows, parseFilmographyQuery({ sort: "role" })).map((r) => r.name)).toEqual(["B", "C", "A"]);
    expect(sortShows(rows, parseFilmographyQuery({ sort: "progress" })).map((r) => r.name)).toEqual(["B", "A", "C"]);
    expect(progressFraction({ watchedCount: 3, totalEpisodes: null })).toBe(0);
    const eps = [episode({ title: "x", watched: false, role: "b" }), episode({ title: "y", watched: true, role: "a", episodeNumber: 2 })];
    expect(sortEpisodes(eps, parseFilmographyQuery({ esort: "watched" })).map((r) => r.title)).toEqual(["y", "x"]);
    expect(sortEpisodes(eps, parseFilmographyQuery({ esort: "role" })).map((r) => r.title)).toEqual(["y", "x"]);
  });
  it("grouped rows expose their individual roles", () => {
    const grouped = groupShowRows([show({ showId: 1, role: "A" }), show({ showId: 1, role: "B" })], defaults);
    expect(grouped[0].roles).toEqual(["A", "B"]);
  });
});

describe("coerceYearRange", () => {
  it("leaves valid ranges alone", () => {
    expect(coerceYearRange("from", 2010, 2000, 2020)).toEqual({ from: 2010, to: 2020 });
    expect(coerceYearRange("to", 2015, 2010, 2020)).toEqual({ from: 2010, to: 2015 });
  });
  it("drags the other end to match when the range becomes impossible", () => {
    expect(coerceYearRange("from", 2015, 2010, 2014)).toEqual({ from: 2015, to: 2015 });
    expect(coerceYearRange("to", 2005, 2010, 2020)).toEqual({ from: 2005, to: 2005 });
  });
  it("clearing one end never touches the other", () => {
    expect(coerceYearRange("from", null, 2010, 2005)).toEqual({ from: null, to: 2005 });
    expect(coerceYearRange("to", null, 2010, 2005)).toEqual({ from: 2010, to: null });
  });
  it("an open other end stays open", () => {
    expect(coerceYearRange("from", 2015, null, null)).toEqual({ from: 2015, to: null });
  });
});
