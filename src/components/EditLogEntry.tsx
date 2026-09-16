"use client";

import { useActionState, useState } from "react";
import { type ActionState, updateLogEntry } from "@/app/actions/watch";
import { RATING_MAX, RATING_MIN } from "@/lib/constants";

export interface EditableLogEntry {
  id: string;
  /** YYYY-MM-DD in the server's local time zone. */
  watchedOn: string;
  rating: number | null;
  reviewText: string | null;
  rewatch: boolean;
}

/** "Edit" link that expands into an inline form for one diary entry. */
export function EditLogEntry({ entry, today }: { entry: EditableLogEntry; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await updateLogEntry(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted underline hover:text-foreground">
        Edit
      </button>
    );
  }

  return (
    <form action={action} className="card mt-2 flex w-full flex-col gap-3 text-sm">
      <input type="hidden" name="id" value={entry.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Watched on</span>
          <input type="date" name="watchedOn" defaultValue={entry.watchedOn} max={today} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Rating <span className="text-muted">(optional, %)</span></span>
          <input type="number" name="rating" min={RATING_MIN} max={RATING_MAX} defaultValue={entry.rating ?? ""} placeholder="e.g. 85" className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Review <span className="text-muted">(optional)</span></span>
        <textarea name="reviewText" rows={3} defaultValue={entry.reviewText ?? ""} className="input" />
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="rewatch" defaultChecked={entry.rewatch} className="accent-accent" /> Already watched
          <span className="text-xs text-muted">(rewatch)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="containsSpoilers" className="accent-accent" /> Review contains spoilers
        </label>
      </div>
      {state?.error && <p role="alert" className="text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
      </div>
    </form>
  );
}
