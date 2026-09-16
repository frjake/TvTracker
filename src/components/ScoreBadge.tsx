import type { Score } from "@/lib/ratings";
import { formatPercent } from "@/lib/ratings";

/**
 * Community score pill. Users' average when any exist, otherwise TMDB's percentage
 * clearly labeled as such. `tmdbPercent` is shown as a secondary number when the
 * primary value comes from users.
 */
export function ScoreBadge({
  score,
  tmdbPercent,
  size = "md",
}: {
  score: Score | null;
  tmdbPercent?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (!score) return <span className="text-xs text-muted">Not yet rated</span>;

  const valueClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-xl";
  const isUsers = score.source === "users";

  return (
    <div className="inline-flex items-baseline gap-2" title={isUsers ? "Average of TvTracker ratings" : "TMDB score (no TvTracker ratings yet)"}>
      <span className={`${valueClass} font-semibold tabular-nums ${isUsers ? "text-accent" : "text-foreground"}`}>
        {formatPercent(score.value)}
      </span>
      <span className="text-xs text-muted">
        {isUsers ? `${score.count} rating${score.count === 1 ? "" : "s"}` : "TMDB"}
      </span>
      {isUsers && tmdbPercent != null && size !== "sm" && (
        <span className="text-xs text-muted">· TMDB {formatPercent(tmdbPercent)}</span>
      )}
    </div>
  );
}
