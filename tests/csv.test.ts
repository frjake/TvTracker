import { describe, expect, it } from "vitest";
import { csvField, fileSafeName, parseCsv, toCsv, uniqueNames } from "@/lib/csv";

describe("csvField", () => {
  it("leaves plain values alone", () => {
    expect(csvField("Ted Lasso")).toBe("Ted Lasso");
    expect(csvField(85)).toBe("85");
  });
  it("quotes commas, quotes and newlines, doubling quotes", () => {
    expect(csvField("Lasso, Ted")).toBe('"Lasso, Ted"');
    expect(csvField('He said "believe"')).toBe('"He said ""believe"""');
    expect(csvField("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvField("a\r\nb")).toBe('"a\r\nb"');
  });
  it("renders empties and booleans like Letterboxd", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField(true)).toBe("Yes");
    expect(csvField(false)).toBe("");
  });
  it("keeps non-ASCII text intact", () => {
    expect(csvField("Cristo Fernández")).toBe("Cristo Fernández");
  });
});

describe("toCsv", () => {
  it("writes a header and rows with CRLF endings", () => {
    expect(toCsv(["Show", "Rating"], [["Ted Lasso", 85], ["Lasso, Ted", null]])).toBe(
      'Show,Rating\r\nTed Lasso,85\r\n"Lasso, Ted",\r\n',
    );
  });
  it("writes just the header when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B\r\n");
  });
});

describe("file names", () => {
  it("slugifies list names safely", () => {
    expect(fileSafeName("Comfort episodes!")).toBe("comfort-episodes");
    expect(fileSafeName("Café ★ Night/Day")).toBe("cafe-night-day");
    expect(fileSafeName("../../etc")).toBe("etc");
    expect(fileSafeName("★★★")).toBe("list");
  });
  it("de-duplicates in order", () => {
    expect(uniqueNames(["a", "a", "b", "a"])).toEqual(["a", "a-2", "b", "a-3"]);
  });
});

describe("parseCsv", () => {
  it("round-trips what toCsv writes, including quotes, commas and newlines", () => {
    const rows = [["Show", "Review"], ["Ted Lasso", 'He said "believe", twice\nthen left'], ["Lasso, Ted", ""]];
    expect(parseCsv(toCsv(rows[0], rows.slice(1)))).toEqual(rows);
  });
  it("accepts LF and CR line endings, a BOM, and a missing trailing newline", () => {
    expect(parseCsv("\uFEFFa,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\r1,2\r")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("drops blank lines and keeps empty fields", () => {
    expect(parseCsv("a,b\r\n\r\n,\r\n")).toEqual([["a", "b"], ["", ""]]);
  });
});
