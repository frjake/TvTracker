import { percentWatched } from "@/lib/progress";

/**
 * "70% watched · 7/10" with a slim bar. Renders a muted "Not started" when nothing has been
 * watched and nothing when the total is unknown. `compact` drops the bar (for table cells and cards).
 */
export function ProgressLabel({
  watched,
  total,
  compact = false,
}: {
  watched: number;
  total: number | null | undefined;
  compact?: boolean;
}) {
  const pct = percentWatched(watched, total);
  if (pct == null) return null;
  const done = pct >= 100;
  const text = watched <= 0 ? "Not started" : `${pct}% watched`;
  const detail = `${Math.min(watched, total!)}/${total}`;

  if (compact) {
    return (
      <span className={`text-xs tabular-nums ${done ? "text-accent" : "text-muted"}`} title={`${detail} episodes`}>
        {done ? "✓ " : ""}{text}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1" aria-label={`${text}, ${detail} episodes`}>
      <div className="flex items-baseline gap-2 text-sm">
        <span className={`font-medium ${done ? "text-accent" : ""}`}>{done ? "✓ " : ""}{text}</span>
        <span className="text-xs text-muted tabular-nums">{detail} episodes</span>
      </div>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
