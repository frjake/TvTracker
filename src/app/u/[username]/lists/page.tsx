import Link from "next/link";
import { ProgressLabel } from "@/components/ProgressLabel";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";
import { sumProgress } from "@/lib/progress";
import { seasonWatchedCountsFor, watchedEpisodeIds } from "@/lib/scores";

export default async function ProfileListsPage(props: PageProps<"/u/[username]/lists">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null;

  const lists = await prisma.list.findMany({
    where: { userId: ctx.owner.id },
    include: {
      _count: { select: { items: true } },
      items: { select: { episodeId: true, seasonId: true, season: { select: { episodeCount: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Viewer's progress through each list.
  const allItems = lists.flatMap((l) => l.items);
  const [seen, seasonCounts] = ctx.viewer
    ? await Promise.all([
        watchedEpisodeIds(ctx.viewer.id, allItems.flatMap((i) => (i.episodeId != null ? [i.episodeId] : []))),
        seasonWatchedCountsFor(ctx.viewer.id, allItems.flatMap((i) => (i.seasonId != null ? [i.seasonId] : []))),
      ])
    : [new Set<number>(), new Map<number, { watched: number; total: number }>()];
  const progressOf = (l: (typeof lists)[number]) =>
    sumProgress(
      l.items.map((i) => {
        if (i.episodeId != null) return { watched: seen.has(i.episodeId) ? 1 : 0, total: 1 };
        if (i.seasonId != null) {
          const c = seasonCounts.get(i.seasonId);
          return c && c.total > 0 ? c : { watched: 0, total: i.season?.episodeCount ?? 0 };
        }
        return null;
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      {ctx.isSelf && (
        <Link href="/lists/new" className="btn-primary self-start">+ New list</Link>
      )}
      {lists.length === 0 ? (
        <p className="text-sm text-muted">No lists yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/lists/${l.id}`} className="card block hover:border-accent">
                <p className="font-medium">{l.name}</p>
                {l.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{l.description}</p>}
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-xs text-muted">
                  <span>{l._count.items} item{l._count.items === 1 ? "" : "s"}</span>
                  {ctx.viewer && l.items.length > 0 && (() => { const pr = progressOf(l); return <ProgressLabel watched={pr.watched} total={pr.total} compact />; })()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
