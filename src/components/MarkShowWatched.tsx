"use client";

import { useState } from "react";
import { markShowWatched, unmarkShowWatched } from "@/app/actions/watch";
import { SubmitButton } from "./forms";

/**
 * "Mark all watched" for a whole show. When the show has a Specials season the click opens a
 * small popover asking whether to include it; otherwise (and when unmarking) it submits directly.
 */
export function MarkShowWatched({ showId, allWatched, hasSpecials }: { showId: number; allWatched: boolean; hasSpecials: boolean }) {
  const [open, setOpen] = useState(false);

  if (allWatched) {
    return (
      <form action={unmarkShowWatched}>
        <input type="hidden" name="showId" value={showId} />
        <SubmitButton className="btn-secondary border-accent text-accent" pendingText="Saving…">✓ All watched · Unmark</SubmitButton>
      </form>
    );
  }

  if (!hasSpecials) {
    return (
      <form action={markShowWatched}>
        <input type="hidden" name="showId" value={showId} />
        <SubmitButton className="btn-secondary" pendingText="Saving…">Mark all watched</SubmitButton>
      </form>
    );
  }

  return (
    <div className="relative">
      <button type="button" className="btn-secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        Mark all watched
      </button>
      {open && (
        <form action={markShowWatched} role="dialog" aria-label="Include specials?" className="card absolute left-0 z-10 mt-1 flex w-64 flex-col gap-2 p-3 shadow-lg">
          <input type="hidden" name="showId" value={showId} />
          <p className="text-sm font-medium">This show has specials.</p>
          <p className="text-xs text-muted">Mark them watched too?</p>
          <SubmitButton className="btn-primary" pendingText="Saving…">Regular seasons only</SubmitButton>
          <SubmitButton className="btn-secondary" name="includeSpecials" value="on" pendingText="Saving…">Include specials</SubmitButton>
          <button type="button" className="text-xs text-muted underline self-start" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
}
