import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moveListItem, removeFromList } from "@/app/actions/lists";
import { SubmitButton } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/policies";
import { viewerCanSee } from "@/lib/social";
import { imageUrl } from "@/lib/tmdb";
import { EditListForm } from "./EditListForm";

type Props = PageProps<"/lists/[listId]">;

async function load(props: Props) {
  const { listId } = await props.params;
  return prisma.list.findUnique({
    where: { id: listId },
    include: {
      user: { select: { id: true, username: true, displayName: true, isPrivate: true } },
      items: {
        orderBy: { position: "asc" },
        include: { episode: { include: { show: true } }, season: { include: { show: true } } },
      },
    },
  });
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const list = await load(props);
  return { title: list?.name ?? "List" };
}

export default async function ListPage(props: Props) {
  const list = await load(props);
  if (!list) notFound();
  const viewer = await getCurrentUser();
  if (!(await viewerCanSee(viewer, list.user))) notFound();
  const owner = canEdit(viewer, list.userId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          List by{" "}
          <Link href={`/u/${list.user.username}`} className="hover:underline">
            {list.user.displayName ?? `@${list.user.username}`}
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{list.name}</h1>
        {list.description && <p className="max-w-2xl text-sm leading-relaxed">{list.description}</p>}
        <p className="text-sm text-muted">{list.items.length} item{list.items.length === 1 ? "" : "s"}</p>
        {owner && <EditListForm list={{ id: list.id, name: list.name, description: list.description }} />}
      </header>

      {list.items.length === 0 ? (
        <p className="card text-sm text-muted">
          Nothing here yet. {owner && "Use “Add to list” on any episode or season page."}
        </p>
      ) : (
        <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
          {list.items.map((item, i) => {
            const show = item.episode?.show ?? item.season?.show;
            if (!show) return null;
            const href = item.episode
              ? `/show/${show.id}/season/${item.episode.seasonNumber}/episode/${item.episode.episodeNumber}`
              : `/show/${show.id}/season/${item.season!.seasonNumber}`;
            const label = item.episode
              ? `S${item.episode.seasonNumber}E${item.episode.episodeNumber} · ${item.episode.name}`
              : item.season!.name;
            const thumb = imageUrl(item.season?.posterPath ?? show.posterPath, "w92");
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                <div className="w-8 shrink-0">
                  {thumb ? <Image src={thumb} alt="" width={92} height={138} className="rounded" /> : <div className="aspect-[2/3] rounded bg-background" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={href} className="font-medium hover:underline">{show.name}</Link>
                  <p className="text-muted">{label}</p>
                </div>
                {owner && (
                  <div className="flex items-center gap-1">
                    <form action={moveListItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <SubmitButton className="btn-secondary px-2 py-1" disabled={i === 0} aria-label="Move up">↑</SubmitButton>
                    </form>
                    <form action={moveListItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <SubmitButton className="btn-secondary px-2 py-1" disabled={i === list.items.length - 1} aria-label="Move down">↓</SubmitButton>
                    </form>
                    <form action={removeFromList}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <SubmitButton className="btn-secondary px-2 py-1" aria-label="Remove">✕</SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
