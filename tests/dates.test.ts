import { describe, expect, it } from "vitest";
import { combineDateWithNow, dateKey, dayBounds, endOfDayTimestamp, isDateString, timeAgo } from "@/lib/dates";

describe("combineDateWithNow", () => {
  const now = new Date(2026, 8, 16, 21, 15, 30, 250); // Sep 16 2026, 21:15:30.250 local

  it("keeps the chosen calendar day but takes the current time of day", () => {
    const d = combineDateWithNow("2026-09-01", 0, now);
    expect(dateKey(d)).toBe("2026-09-01");
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([21, 15, 30]);
  });

  it("orders successive backdated entries by the moment they were logged", () => {
    const first = combineDateWithNow("2026-09-01", 0, now);
    const later = combineDateWithNow("2026-09-01", 0, new Date(now.getTime() + 5000));
    expect(later.getTime()).toBeGreaterThan(first.getTime());
  });

  it("spaces season logs one second apart in episode order", () => {
    const e1 = combineDateWithNow("2026-09-01", 0, now);
    const e2 = combineDateWithNow("2026-09-01", 1, now);
    const e3 = combineDateWithNow("2026-09-01", 2, now);
    expect(e2.getTime() - e1.getTime()).toBe(1000);
    expect(e3.getTime() - e2.getTime()).toBe(1000);
  });

  it("never spills into the next day when logging late at night", () => {
    const late = new Date(2026, 8, 16, 23, 59, 58);
    const d = combineDateWithNow("2026-09-01", 30, late);
    expect(dateKey(d)).toBe("2026-09-01");
  });
});

describe("isDateString", () => {
  it("accepts YYYY-MM-DD and rejects everything else", () => {
    expect(isDateString("2026-09-16")).toBe(true);
    expect(isDateString("2026-9-16")).toBe(false);
    expect(isDateString("not a date")).toBe(false);
    expect(isDateString(20260916)).toBe(false);
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 8, 16, 12, 0, 0);
  it("describes recent moments", () => {
    expect(timeAgo(new Date(now.getTime() - 30_000), now)).toBe("just now");
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000), now)).toBe("5m ago");
    expect(timeAgo(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3h ago");
    expect(timeAgo(new Date(now.getTime() - 2 * 86_400_000), now)).toBe("2d ago");
  });
});

describe("endOfDayTimestamp", () => {
  const now = new Date(2026, 10, 12, 9, 30, 0); // Nov 12, 09:30 local

  it("uses the current time of day when the day has nothing later", () => {
    const d = endOfDayTimestamp("2026-10-01", new Date(2026, 9, 1, 8, 0, 0), now);
    expect(dateKey(d)).toBe("2026-10-01");
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 30]);
    expect(endOfDayTimestamp("2026-10-01", null, now).getHours()).toBe(9);
  });

  it("goes one second after the latest entry when that one is later in the day", () => {
    const latest = new Date(2026, 9, 1, 22, 15, 0);
    expect(endOfDayTimestamp("2026-10-01", latest, now).getTime()).toBe(latest.getTime() + 1000);
  });

  it("spaces a batch one second apart after the latest entry", () => {
    const latest = new Date(2026, 9, 1, 22, 15, 0);
    const times = [0, 1, 2].map((i) => endOfDayTimestamp("2026-10-01", latest, now, i).getTime());
    expect(times).toEqual([1, 2, 3].map((s) => latest.getTime() + s * 1000));
  });

  it("never spills into the next day", () => {
    const latest = new Date(2026, 9, 1, 23, 59, 59, 900);
    const d = endOfDayTimestamp("2026-10-01", latest, now);
    expect(dateKey(d)).toBe("2026-10-01");
    expect(d.getTime()).toBe(dayBounds("2026-10-01").end.getTime() - 1);
  });
});

describe("dayBounds", () => {
  it("covers one local calendar day", () => {
    const { start, end } = dayBounds("2026-10-31");
    expect([dateKey(start), start.getHours()]).toEqual(["2026-10-31", 0]);
    expect([dateKey(end), end.getHours()]).toEqual(["2026-11-01", 0]);
  });
});
