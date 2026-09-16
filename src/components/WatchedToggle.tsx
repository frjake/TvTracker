import { toggleWatched } from "@/app/actions/watch";
import { SubmitButton, TargetFields } from "./forms";

export function WatchedToggle({
  showId,
  seasonNumber,
  episodeNumber,
  watched,
  viaLog,
}: {
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  watched: boolean;
  /** True when the episode is in the diary; the mark can't be removed from here then. */
  viaLog: boolean;
}) {
  if (viaLog) {
    return (
      <span className="btn-secondary cursor-default border-accent text-accent" title="In your log">
        ✓ Watched (logged)
      </span>
    );
  }
  return (
    <form action={toggleWatched}>
      <TargetFields showId={showId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} />
      <SubmitButton className={watched ? "btn-secondary border-accent text-accent" : "btn-secondary"} pendingText="Saving…">
        {watched ? "✓ Watched" : "Mark watched"}
      </SubmitButton>
    </form>
  );
}
