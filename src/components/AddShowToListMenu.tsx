"use client";

import Link from "next/link";
import { useState } from "react";
import { addShowToList } from "@/app/actions/lists";
import { SubmitButton } from "./forms";

export interface ShowListOption {
  id: string;
  name: string;
  /** How many of this show's seasons are already on the list as their own items. */
  present: number;
  /** Whether the whole show is already on the list as a single item. */
  hasShow: boolean;
}

type Mode = "show" | "seasons";

/**
 * "Add show to list" dropdown. "One item" adds the whole show as a single list entry; "Each
 * season" adds every season as its own item, with a Specials checkbox when the show has them.
 */
export function AddShowToListMenu({
  showId,
  lists,
  seasonCount,
  hasSpecials,
}: {
  showId: number;
  lists: ShowListOption[];
  /** Regular (non-special) seasons. */
  seasonCount: number;
  hasSpecials: boolean;
}) {
  const [mode, setMode] = useState<Mode>("show");
  const [includeSpecials, setIncludeSpecials] = useState(false);
  const specials = mode === "seasons" && includeSpecials;
  const total = seasonCount + (specials ? 1 : 0);

  const params = new URLSearchParams({ showId: String(showId), wholeShow: "1", mode, returnTo: `/show/${showId}` });
  if (specials) params.set("includeSpecials", "on");

  return (
    <details className="relative">
      <summary className="btn-secondary cursor-pointer list-none">Add show to list ▾</summary>
      <div className="card absolute left-0 z-10 mt-1 flex w-72 flex-col gap-1 p-2 shadow-lg">
        <fieldset className="flex flex-col gap-1 px-2 py-1 text-sm">
          <legend className="mb-1 text-xs text-muted">Add as</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="add-show-mode" checked={mode === "show"} onChange={() => setMode("show")} className="accent-accent" />
            One item (whole show)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="add-show-mode" checked={mode === "seasons"} onChange={() => setMode("seasons")} className="accent-accent" />
            Each season{seasonCount > 0 ? ` (${seasonCount})` : ""}
          </label>
          {mode === "seasons" && hasSpecials && (
            <label className="ml-6 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeSpecials} onChange={(e) => setIncludeSpecials(e.target.checked)} className="accent-accent" />
              Include specials
            </label>
          )}
        </fieldset>
        <div className="border-t border-line" />
        {lists.length === 0 && <p className="px-2 py-1 text-sm text-muted">You have no lists yet.</p>}
        {lists.map((list) => {
          const complete = mode === "show" ? list.hasShow : list.present >= total;
          const status =
            mode === "show"
              ? list.hasShow ? "✓ added" : null
              : list.present > 0 ? (complete ? "✓ added" : `${list.present}/${total} seasons`) : null;
          return (
            <form key={list.id} action={addShowToList}>
              <input type="hidden" name="showId" value={showId} />
              <input type="hidden" name="listId" value={list.id} />
              <input type="hidden" name="mode" value={mode} />
              {specials && <input type="hidden" name="includeSpecials" value="on" />}
              <SubmitButton
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-background disabled:opacity-60"
                disabled={complete}
                pendingText="Adding…"
              >
                <span className="truncate">{list.name}</span>
                {status && <span className="text-xs text-accent">{status}</span>}
              </SubmitButton>
            </form>
          );
        })}
        <Link href={`/lists/new?${params}`} className="mt-1 border-t border-line px-2 pt-2 text-sm text-accent hover:underline">
          + New list
        </Link>
      </div>
    </details>
  );
}
