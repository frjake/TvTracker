import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { normalizeZipPath, parseExportFiles } from "@/lib/import-parse";

const DIARY_HEADERS = ["Watched Date", "Show", "Year", "Season", "Episode", "Episode Title", "Rating", "Rewatch", "Review", "TMDB Show ID", "Logged Date"];

describe("normalizeZipPath", () => {
  it("keeps the export layout and flattens a re-zipped folder", () => {
    expect(normalizeZipPath("diary.csv")).toBe("diary.csv");
    expect(normalizeZipPath("tvtracker-felix-2026-10-24/Diary.csv")).toBe("diary.csv");
    expect(normalizeZipPath("tvtracker-felix/lists/comfort.csv")).toBe("lists/comfort.csv");
  });
  it("ignores non-CSV files and macOS metadata", () => {
    expect(normalizeZipPath("readme.txt")).toBeNull();
    expect(normalizeZipPath("__MACOSX/._diary.csv")).toBeNull();
    expect(normalizeZipPath("x/._diary.csv")).toBeNull();
    expect(normalizeZipPath("lists/")).toBeNull();
  });
});

describe("parseExportFiles", () => {
  it("parses diary rows", () => {
    const out = parseExportFiles({
      "diary.csv": toCsv(DIARY_HEADERS, [["2026-09-10", "Ted Lasso", "2020", 1, 1, "Pilot", 90, "Yes", "Warm, funny.", 97546, "2026-09-16"]]),
    });
    expect(out.problems).toEqual([]);
    expect(out.recognized).toEqual(["diary.csv"]);
    expect(out.diary[0]).toMatchObject({
      row: 2,
      target: { kind: "episode", show: { tmdbId: 97546, name: "Ted Lasso", year: "2020" }, season: 1, episode: 1 },
      watchedOn: "2026-09-10",
      rating: 90,
      rewatch: true,
      review: "Warm, funny.",
      loggedOn: "2026-09-16",
    });
  });

  it("reports bad rows with their row number and keeps the good ones", () => {
    const out = parseExportFiles({
      "diary.csv": toCsv(DIARY_HEADERS, [
        ["2026-09-10", "Ted Lasso", "2020", 1, 1, "Pilot", 150, "", "", 97546, ""],
        ["not a date", "Ted Lasso", "2020", 1, 2, "Biscuits", "", "", "", 97546, ""],
        ["2026-09-11", "Ted Lasso", "2020", 1, 3, "Trent Crimm", "", "", "", 97546, ""],
      ]),
    });
    expect(out.diary.map((d) => d.target)).toHaveLength(1);
    expect(out.problems).toEqual([
      { file: "diary.csv", row: 2, message: "Rating must be a whole number from 0 to 100." },
      { file: "diary.csv", row: 3, message: "Watched Date must be a date like 2026-10-24." },
    ]);
  });

  it("flags a file with missing columns instead of guessing", () => {
    const out = parseExportFiles({ "ratings.csv": "Show,Rating\r\nTed Lasso,80\r\n" });
    expect(out.ratings).toEqual([]);
    expect(out.problems).toEqual([{ file: "ratings.csv", row: null, message: "Missing column: Season." }]);
  });

  it("reads typed rows as season or episode targets and works without a TMDB id (older exports)", () => {
    const out = parseExportFiles({
      "ratings.csv": toCsv(["Date", "Show", "Year", "Type", "Season", "Episode", "Title", "Rating"], [
        ["2026-09-16", "Ted Lasso", "2020", "Season", 1, "", "Season 1", 80],
        ["2026-09-16", "Ted Lasso", "2020", "Episode", 1, 1, "Pilot", 90],
      ]),
    });
    expect(out.ratings.map((r) => r.target)).toEqual([
      { kind: "season", show: { tmdbId: null, name: "Ted Lasso", year: "2020" }, season: 1 },
      { kind: "episode", show: { tmdbId: null, name: "Ted Lasso", year: "2020" }, season: 1, episode: 1 },
    ]);
  });

  it("builds lists from the index and its per-list files, plus unindexed list files", () => {
    const item = ["Position", "Show", "Year", "Type", "Season", "Episode", "Title", "Note", "TMDB Show ID"];
    const out = parseExportFiles({
      "lists.csv": toCsv(["Name", "Description", "Items", "Created", "Updated", "File"], [["Comfort episodes", "For bad days", 1, "", "", "lists/comfort-episodes.csv"]]),
      "lists/comfort-episodes.csv": toCsv(item, [[1, "Ted Lasso", "2020", "Episode", 1, 2, "Biscuits", "the best", 97546]]),
      "lists/stray-list.csv": toCsv(item, [[1, "Ted Lasso", "2020", "Season", 2, "", "Season 2", "", 97546]]),
    });
    expect(out.lists.map((l) => [l.name, l.description, l.items.length])).toEqual([
      ["Comfort episodes", "For bad days", 1],
      ["stray list", null, 1],
    ]);
    expect(out.lists[0].items[0]).toMatchObject({ note: "the best", target: { kind: "episode", season: 1, episode: 2 } });
  });

  it("notes ignored files and recognises nothing in an unrelated zip", () => {
    const out = parseExportFiles({ "profile.csv": "Username\r\nfelix\r\n", "following.csv": "Username\r\n" });
    expect(out.ignored).toEqual(["profile.csv", "following.csv"]);
    expect(out.recognized).toEqual([]);
  });
});
