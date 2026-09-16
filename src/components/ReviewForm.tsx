"use client";

import { useActionState } from "react";
import { type ActionState, deleteReview, saveReview } from "@/app/actions/watch";
import { TargetFields } from "./forms";

export function ReviewForm({
  showId,
  seasonNumber,
  episodeNumber,
  existing,
}: {
  showId: number;
  seasonNumber: number;
  episodeNumber?: number;
  existing: { id: string; body: string; containsSpoilers: boolean } | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveReview, undefined);

  return (
    <div className="card flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <TargetFields showId={showId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} />
        <label htmlFor="review-body" className="label">{existing ? "Your review" : "Write a review"}</label>
        <textarea
          id="review-body"
          name="body"
          rows={5}
          defaultValue={existing?.body ?? ""}
          className="input"
          placeholder="Share your thoughts…"
          required
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="containsSpoilers" defaultChecked={existing?.containsSpoilers ?? false} className="accent-accent" />
          Contains spoilers
        </label>
        {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        {state?.ok && !state.error && <p className="text-sm text-accent">Saved.</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : existing ? "Update review" : "Post review"}
          </button>
        </div>
      </form>
      {existing && (
        <form action={deleteReview} className="self-start">
          <input type="hidden" name="id" value={existing.id} />
          <button type="submit" className="text-sm text-muted underline hover:text-red-600">Delete review</button>
        </form>
      )}
    </div>
  );
}
