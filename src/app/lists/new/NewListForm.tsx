"use client";

import { useActionState } from "react";
import { type ListFormState, createList } from "@/app/actions/lists";
import { TargetFields } from "@/components/forms";

export interface NewListTarget {
  showId: number;
  /** Absent for a whole-show target (every season becomes an item). */
  seasonNumber?: number;
  episodeNumber?: number;
  /** Whole-show only: also add the Specials season. */
  includeSpecials?: boolean;
  /** Human-readable name of the item, e.g. "Ted Lasso S1E2 · Biscuits". */
  label: string;
  returnTo: string;
}

export function NewListForm({ target }: { target?: NewListTarget | null }) {
  const [state, action, pending] = useActionState<ListFormState, FormData>(createList, undefined);
  return (
    <form action={action} className="card mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">New list</h1>
      {target && (
        <>
          {target.seasonNumber != null ? (
            <TargetFields showId={target.showId} seasonNumber={target.seasonNumber} episodeNumber={target.episodeNumber} />
          ) : (
            <>
              <input type="hidden" name="showId" value={target.showId} />
              <input type="hidden" name="wholeShow" value="1" />
              {target.includeSpecials && <input type="hidden" name="includeSpecials" value="on" />}
            </>
          )}
          <input type="hidden" name="returnTo" value={target.returnTo} />
          <p className="rounded-md bg-accent-soft px-3 py-2 text-sm">
            <span className="font-medium">{target.label}</span>{" "}
            {target.seasonNumber != null ? "will be added as the first item." : `— every season${target.includeSpecials ? " (including specials)" : ""} will be added.`}
          </p>
        </>
      )}
      <div>
        <label htmlFor="name" className="label">Name</label>
        <input id="name" name="name" className="input mt-1" required maxLength={100} placeholder="e.g. Comfort episodes" autoFocus />
      </div>
      <div>
        <label htmlFor="description" className="label">Description <span className="text-muted">(optional)</span></label>
        <textarea id="description" name="description" rows={3} className="input mt-1" maxLength={2000} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" className="btn-primary self-start" disabled={pending}>
        {pending ? "Creating…" : target ? "Create list and add" : "Create list"}
      </button>
    </form>
  );
}
