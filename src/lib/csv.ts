// Pure CSV helpers for the account export (tested in tests/csv.test.ts).

export type CsvValue = string | number | boolean | null | undefined;

/** RFC 4180 field: quoted when it contains a comma, quote, CR or LF; quotes doubled. */
export function csvField(value: CsvValue): string {
  if (value == null) return "";
  const s = typeof value === "boolean" ? (value ? "Yes" : "") : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header row + data rows, CRLF line endings, trailing newline. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** A list name turned into a safe file name stem ("Comfort episodes!" → "comfort-episodes"). */
export function fileSafeName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "list";
}

/** De-duplicates stems in order: ["a", "a", "b"] → ["a", "a-2", "b"]. */
export function uniqueNames(stems: string[]): string[] {
  const seen = new Map<string, number>();
  return stems.map((stem) => {
    const n = (seen.get(stem) ?? 0) + 1;
    seen.set(stem, n);
    return n === 1 ? stem : `${stem}-${n}`;
  });
}
