"use client";

import { useActionState, useState } from "react";
import { type ActionState, logEpisode, logSeason } from "@/app/actions/watch";
import { RATING_MAX, RATING_MIN } from "@/lib/constants";
import { TargetFields } from "./forms";

/**
 * "Log" button that expands into a diary form. The date defaults to today; the server
 * combines it with the current clock time so same-day entries keep their order.
 */
export function LogDialog({
  showId,
  seasonNumber,
  episodeNumber,
  today,
  episodeCount,
  alreadyWatched = false,
}: {
  showId: number;
  seasonNumber: number;
  episodeNumber?: number;
  today: string;
  /** For season logging: how many entries will be created. */
  episodeCount?: number;
  /** Pre-checks "Already watched" when the episode (or every episode of the season) was marked or logged before. */
  alreadyWatched?: boolean;
}) {
  const isSeason = episodeNumber == null;
  const [open, setOpen] = useState(false);
  const serverAction = isSeason ? logSeason : logEpisode;
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await serverAction(prev, formData);
    if (result?.ok) setOpen(false); // close on success; errors keep the form open
    return result;
  }, undefined);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        {isSeason ? "Log whole season" : "Log"}
      </button>
    );
  }

  return (
    <form action={action} className="card flex w-full max-w-lg flex-col gap-3">
      <TargetFields showId={showId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} />
      <h3 className="font-semibold">
        {isSeason ? `Log all ${episodeCount ?? ""} episodes` : "Log this episode"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="log-date" className="label">Watched on</label>
          <input id="log-date" type="date" name="watchedOn" defaultValue={today} max={today} required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="log-rating" className="label">
            {isSeason ? "Season rating" : "Rating"} <span className="text-muted">(optional, %)</span>
          </label>
          <input id="log-rating" type="number" name="rating" min={RATING_MIN} max={RATING_MAX} placeholder="e.g. 85" className="input mt-1" />
        </div>
      </div>
      <div>
        <label htmlFor="log-review" className="label">
          Review <span className="text-muted">(optional)</span>
        </label>
        <textarea id="log-review" name="reviewText" rows={3} className="input mt-1" placeholder="What did you think?" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="rewatch" defaultChecked={alreadyWatched} className="accent-accent" /> Already watched
          <span className="text-xs text-muted">(this is a rewatch)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="containsSpoilers" className="accent-accent" /> Contains spoilers
        </label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save to log"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
