// Date helpers for the watch log. Log entries store a full timestamp (watchedAt) so
// several entries on one day keep the order they were logged in; only the date is shown.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

/** Today's date as YYYY-MM-DD in the server's local time zone. */
export function todayString(now = new Date()): string {
  return dateKey(now);
}

/** YYYY-MM-DD (local time) for grouping and <input type="date"> values. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The chosen calendar day combined with the current time of day, plus an optional
 * offset in seconds (used to keep episode order when logging a whole season at once).
 * Logging in sequence — even when backdating — therefore keeps that sequence.
 */
export function combineDateWithNow(dateStr: string, offsetSeconds = 0, now = new Date()): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  result.setSeconds(result.getSeconds() + offsetSeconds);
  // Never let the offset spill into the next day.
  if (dateKey(result) !== dateStr) {
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return result;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function timeAgo(d: Date, now = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
