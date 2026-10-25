// Pure parsing for the account import (no server imports; tested in tests/import-parse.test.ts).
// Turns the CSV files of a TvTracker export into typed rows plus a list of row-level problems.
// Matching rows to shows/episodes and checking for duplicates happens later, on the server.

import { parseCsv } from "./csv";
import { isDateString } from "./dates";

export interface ImportProblem {
  file: string;
  /** Spreadsheet row (header = 1); null for file-level problems. */
  row: number | null;
  message: string;
}

export interface ShowRef {
  tmdbId: number | null;
  name: string;
  year: string;
}

export type EpisodeTarget = { kind: "episode"; show: ShowRef; season: number; episode: number };
export type SeasonTarget = { kind: "season"; show: ShowRef; season: number };
export type ImportTarget = EpisodeTarget | SeasonTarget;

interface RowBase {
  file: string;
  row: number;
}
export interface DiaryRow extends RowBase {
  target: EpisodeTarget;
  watchedOn: string;
  rating: number | null;
  rewatch: boolean;
  review: string | null;
  loggedOn: string | null;
}
export interface WatchedRow extends RowBase {
  target: EpisodeTarget;
  date: string | null;
}
export interface RatingRow extends RowBase {
  target: ImportTarget;
  date: string | null;
  value: number;
}
export interface ReviewRow extends RowBase {
  target: ImportTarget;
  date: string | null;
  body: string;
  spoilers: boolean;
  editedAt: string | null;
}
export interface ListItemRow extends RowBase {
  target: ImportTarget;
  note: string | null;
}
export interface ListDef {
  name: string;
  description: string | null;
  file: string;
  items: ListItemRow[];
}

export interface ParsedExport {
  /** Files that were imported from. */
  recognized: string[];
  /** Files present in the zip that are deliberately not imported (profile, follows). */
  ignored: string[];
  diary: DiaryRow[];
  watched: WatchedRow[];
  ratings: RatingRow[];
  reviews: ReviewRow[];
  lists: ListDef[];
  problems: ImportProblem[];
}

const IGNORED_FILES = ["profile.csv", "followers.csv", "following.csv"];

/**
 * Maps a path inside the zip to the export's own layout, so a re-zipped folder still works:
 * "tvtracker-felix/lists/a.csv" → "lists/a.csv", "x/diary.csv" → "diary.csv".
 * Returns null for anything that isn't a CSV or is macOS metadata.
 */
export function normalizeZipPath(name: string): string | null {
  const parts = name.replace(/\\/g, "/").split("/").filter(Boolean);
  const base = parts.at(-1);
  if (!base || !/\.csv$/i.test(base) || base.startsWith("._") || parts.includes("__MACOSX")) return null;
  return parts.at(-2)?.toLowerCase() === "lists" ? `lists/${base}` : base.toLowerCase();
}

// ---------- low-level readers ----------

type Cells = { row: number; get: (column: string) => string };

function readTable(
  files: Record<string, string>,
  file: string,
  required: string[],
  problems: ImportProblem[],
): Cells[] | null {
  const text = files[file];
  if (text == null) return null;
  const rows = parseCsv(text);
  if (rows.length === 0) {
    problems.push({ file, row: null, message: "File is empty." });
    return [];
  }
  const index = new Map(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  const missing = required.filter((c) => !index.has(c.toLowerCase()));
  if (missing.length > 0) {
    problems.push({ file, row: null, message: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` });
    return [];
  }
  return rows.slice(1).map((cells, i) => ({
    row: i + 2,
    get: (column: string) => {
      const j = index.get(column.toLowerCase());
      return j == null ? "" : (cells[j] ?? "").trim();
    },
  }));
}

class RowError extends Error {}

function int(value: string, label: string, min: number): number {
  const n = Number(value);
  if (value === "" || !Number.isInteger(n) || n < min) throw new RowError(`${label} must be a whole number${min > 0 ? ` of at least ${min}` : ""}.`);
  return n;
}
function optionalInt(value: string): number | null {
  const n = Number(value);
  return value !== "" && Number.isInteger(n) && n > 0 ? n : null;
}
function rating(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new RowError("Rating must be a whole number from 0 to 100.");
  return n;
}
function requiredDate(value: string, label: string): string {
  if (!isDateString(value)) throw new RowError(`${label} must be a date like 2026-10-24.`);
  return value;
}
function optionalDate(value: string): string | null {
  return isDateString(value) ? value : null;
}
function yes(value: string): boolean {
  return /^(yes|y|true|1)$/i.test(value);
}

function showRef(c: Cells): ShowRef {
  const ref = { tmdbId: optionalInt(c.get("TMDB Show ID")), name: c.get("Show"), year: c.get("Year") };
  if (!ref.name && ref.tmdbId == null) throw new RowError("Show is missing.");
  return ref;
}
function episodeTarget(c: Cells): EpisodeTarget {
  return { kind: "episode", show: showRef(c), season: int(c.get("Season"), "Season", 0), episode: int(c.get("Episode"), "Episode", 1) };
}
/** Rows with a Type column: "Season" rows target a whole season, everything else an episode. */
function typedTarget(c: Cells): ImportTarget {
  const type = c.get("Type").toLowerCase();
  if (type === "season" || (type === "" && c.get("Episode") === "")) {
    return { kind: "season", show: showRef(c), season: int(c.get("Season"), "Season", 0) };
  }
  return episodeTarget(c);
}

function eachRow<T>(rows: Cells[] | null, file: string, problems: ImportProblem[], build: (c: Cells) => T): T[] {
  const out: T[] = [];
  for (const c of rows ?? []) {
    try {
      out.push(build(c));
    } catch (err) {
      if (!(err instanceof RowError)) throw err;
      problems.push({ file, row: c.row, message: err.message });
    }
  }
  return out;
}

// ---------- the export ----------

export function parseExportFiles(files: Record<string, string>): ParsedExport {
  const problems: ImportProblem[] = [];
  const recognized: string[] = [];
  const read = (file: string, required: string[]) => {
    const table = readTable(files, file, required, problems);
    if (table) recognized.push(file);
    return table;
  };

  const diary = eachRow(read("diary.csv", ["Watched Date", "Show", "Season", "Episode"]), "diary.csv", problems, (c) => ({
    file: "diary.csv",
    row: c.row,
    target: episodeTarget(c),
    watchedOn: requiredDate(c.get("Watched Date"), "Watched Date"),
    rating: rating(c.get("Rating")),
    rewatch: yes(c.get("Rewatch")),
    review: c.get("Review") || null,
    loggedOn: optionalDate(c.get("Logged Date")),
  }));

  const watched = eachRow(read("watched.csv", ["Show", "Season", "Episode"]), "watched.csv", problems, (c) => ({
    file: "watched.csv",
    row: c.row,
    target: episodeTarget(c),
    date: optionalDate(c.get("Date")),
  }));

  const ratings = eachRow(read("ratings.csv", ["Show", "Season", "Rating"]), "ratings.csv", problems, (c) => {
    const value = rating(c.get("Rating"));
    if (value == null) throw new RowError("Rating is missing.");
    return { file: "ratings.csv", row: c.row, target: typedTarget(c), date: optionalDate(c.get("Date")), value };
  });

  const reviews = eachRow(read("reviews.csv", ["Show", "Season", "Review"]), "reviews.csv", problems, (c) => {
    const body = c.get("Review");
    if (!body) throw new RowError("Review text is missing.");
    const edited = c.get("Last Edited");
    return {
      file: "reviews.csv",
      row: c.row,
      target: typedTarget(c),
      date: optionalDate(c.get("Date")),
      body,
      spoilers: yes(c.get("Contains Spoilers")),
      editedAt: edited && !Number.isNaN(Date.parse(edited)) ? edited : null,
    };
  });

  // Lists: names/descriptions from lists.csv, items from the per-list files it points to. A
  // lists/*.csv file the index doesn't mention is still imported, named after its file.
  const lists: ListDef[] = [];
  const indexed = new Set<string>();
  const index = read("lists.csv", ["Name"]);
  for (const c of index ?? []) {
    const name = c.get("Name");
    if (!name) {
      problems.push({ file: "lists.csv", row: c.row, message: "List name is missing." });
      continue;
    }
    const file = normalizeZipPath(c.get("File")) ?? "";
    if (file.startsWith("lists/")) indexed.add(file);
    lists.push({ name: name.slice(0, 100), description: c.get("Description") || null, file, items: [] });
  }
  for (const file of Object.keys(files).filter((f) => f.startsWith("lists/") && !indexed.has(f)).sort()) {
    lists.push({ name: file.slice("lists/".length).replace(/\.csv$/i, "").replace(/-/g, " "), description: null, file, items: [] });
  }
  for (const list of lists) {
    if (!list.file || files[list.file] == null) continue;
    list.items = eachRow(read(list.file, ["Show", "Season"]), list.file, problems, (c) => ({
      file: list.file,
      row: c.row,
      target: typedTarget(c),
      note: c.get("Note") || null,
    }));
  }

  const ignored = IGNORED_FILES.filter((f) => files[f] != null);
  return { recognized, ignored, diary, watched, ratings, reviews, lists, problems };
}
