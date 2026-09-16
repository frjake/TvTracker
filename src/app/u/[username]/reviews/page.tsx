import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";

export default async function ProfileReviewsPage(props: PageProps<"/u/[username]/reviews">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null;

  const reviews = await prisma.review.findMany({
    where: { userId: ctx.owner.id },
    include: { episode: { include: { show: true } }, season: { include: { show: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (reviews.length === 0) return <p className="text-sm text-muted">No reviews yet.</p>;

  const ratings = await prisma.rating.findMany({
    where: { userId: ctx.owner.id, OR: [{ episodeId: { in: reviews.flatMap((r) => r.episodeId ?? []) } }, { seasonId: { in: reviews.flatMap((r) => r.seasonId ?? []) } }] },
  });
  const ratingFor = (r: (typeof reviews)[number]) =>
    ratings.find((x) => (r.episodeId != null ? x.episodeId === r.episodeId : x.seasonId === r.seasonId))?.value ?? null;

  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((r) => {
        const show = r.episode?.show ?? r.season?.show;
        const href = r.episode
          ? `/show/${show!.id}/season/${r.episode.seasonNumber}/episode/${r.episode.episodeNumber}`
          : `/show/${show!.id}/season/${r.season!.seasonNumber}`;
        const label = r.episode ? `${show!.name} S${r.episode.seasonNumber}E${r.episode.episodeNumber} · ${r.episode.name}` : `${show!.name} – ${r.season!.name}`;
        const rating = ratingFor(r);
        return (
          <li key={r.id} className="card">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm">
              <Link href={href} className="font-medium hover:underline">{label}</Link>
              {rating != null && <span className="font-semibold text-accent">{rating}%</span>}
              <span className="text-xs text-muted">{formatDate(r.updatedAt)}</span>
            </div>
            {r.containsSpoilers ? (
              <details>
                <summary className="cursor-pointer text-sm text-muted">Contains spoilers — click to reveal</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
              </details>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{r.body}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
