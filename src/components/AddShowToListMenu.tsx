"use client";

import Link from "next/link";
import { useState } from "react";
import { addShowToList } from "@/app/actions/lists";
import { SubmitButton } from "./forms";

export interface ShowListOption {
  id: string;
  name: string;
  /** How many of this show's seasons are already on the list. */
  present: number;
}

/**
 * "Add show to list" dropdown. Adds every season as its own list item; when the show has a
 * Specials season the checkbox decides whether it's included (shared by all list buttons).
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
  const [includeSpecials, setIncludeSpecials] = useState(false);
  const total = seasonCount + (includeSpecials ? 1 : 0);
  const params = new URLSearchParams({ showId: String(showId), wholeShow: "1", returnTo: `/show/${showId}` });
  if (includeSpecials) params.set("includeSpecials", "on");

  return (
    <details className="relative">
      <summary className="btn-secondary cursor-pointer list-none">Add show to list ▾</summary>
      <div className="card absolute left-0 z-10 mt-1 flex w-72 flex-col gap-1 p-2 shadow-lg">
        <p className="px-2 py-1 text-xs text-muted">Adds each season as its own item.</p>
        {hasSpecials && (
          <label className="flex items-center gap-2 px-2 py-1 text-sm">
            <input type="checkbox" checked={includeSpecials} onChange={(e) => setIncludeSpecials(e.target.checked)} className="accent-accent" />
            Include specials
          </label>
        )}
        {lists.length === 0 && <p className="px-2 py-1 text-sm text-muted">You have no lists yet.</p>}
        {lists.map((list) => {
          const complete = list.present >= total;
          return (
            <form key={list.id} action={addShowToList}>
              <input type="hidden" name="showId" value={showId} />
              <input type="hidden" name="listId" value={list.id} />
              {includeSpecials && <input type="hidden" name="includeSpecials" value="on" />}
              <SubmitButton
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-background disabled:opacity-60"
                disabled={complete}
                pendingText="Adding…"
              >
                <span className="truncate">{list.name}</span>
                {list.present > 0 && (
                  <span className="text-xs text-accent">{complete ? "✓ added" : `${list.present}/${total} seasons`}</span>
                )}
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
