import Link from "next/link";
import { addToList } from "@/app/actions/lists";
import { prisma } from "@/lib/db";
import { SubmitButton, TargetFields } from "./forms";

/** "Add to list" dropdown for the signed-in user's own lists. Server component. */
export async function AddToListMenu({
  userId,
  showId,
  seasonNumber,
  episodeNumber,
  episodeId,
  seasonId,
}: {
  userId: string;
  showId: number;
  seasonNumber: number;
  episodeNumber?: number;
  episodeId?: number;
  seasonId?: number;
}) {
  const lists = await prisma.list.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        where: episodeId != null ? { episodeId } : { seasonId },
        select: { id: true },
      },
    },
  });

  // "+ New list" carries the item and where to come back to, so the new list starts with it.
  const returnTo = `/show/${showId}/season/${seasonNumber}${episodeNumber != null ? `/episode/${episodeNumber}` : ""}`;
  const params = new URLSearchParams({ showId: String(showId), seasonNumber: String(seasonNumber), returnTo });
  if (episodeNumber != null) params.set("episodeNumber", String(episodeNumber));
  const newListHref = `/lists/new?${params}`;

  return (
    <details className="relative">
      <summary className="btn-secondary cursor-pointer list-none">Add to list ▾</summary>
      <div className="card absolute left-0 z-10 mt-1 flex w-64 flex-col gap-1 p-2 shadow-lg">
        {lists.length === 0 && <p className="px-2 py-1 text-sm text-muted">You have no lists yet.</p>}
        {lists.map((list) => {
          const already = list.items.length > 0;
          return (
            <form key={list.id} action={addToList}>
              <TargetFields showId={showId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} />
              <input type="hidden" name="listId" value={list.id} />
              <SubmitButton
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-background disabled:opacity-60"
                disabled={already}
                pendingText="Adding…"
              >
                <span className="truncate">{list.name}</span>
                {already && <span className="text-xs text-accent">✓ added</span>}
              </SubmitButton>
            </form>
          );
        })}
        <Link href={newListHref} className="mt-1 border-t border-line px-2 pt-2 text-sm text-accent hover:underline">
          + New list
        </Link>
      </div>
    </details>
  );
}
