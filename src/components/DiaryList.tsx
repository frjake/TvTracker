import Image from "next/image";
import Link from "next/link";
import { deleteLogEntry } from "@/app/actions/watch";
import { dateKey, formatDateLong, todayString } from "@/lib/dates";
import { EditLogEntry } from "./EditLogEntry";
import { imageUrl } from "@/lib/tmdb";
import { SubmitButton } from "./forms";

export interface DiaryEntry {
  id: string;
  watchedAt: Date;
  rating: number | null;
  reviewText: string | null;
  rewatch: boolean;
  episode: {
    id: number;
    name: string;
    seasonNumber: number;
    episodeNumber: number;
    stillPath: string | null;
    show: { id: number; name: string; posterPath: string | null };
  };
}

/** Diary grouped by calendar day. Entries must already be sorted watchedAt desc. */
export function DiaryList({ entries, canEdit }: { entries: DiaryEntry[]; canEdit: boolean }) {
  if (entries.length === 0) return <p className="text-sm text-muted">Nothing logged yet.</p>;
  const today = todayString();

  const groups: { key: string; date: Date; entries: DiaryEntry[] }[] = [];
  for (const e of entries) {
    const key = dateKey(e.watchedAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.entries.push(e);
    else groups.push({ key, date: e.watchedAt, entries: [e] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{formatDateLong(g.date)}</h3>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {g.entries.map((e) => {
              const ep = e.episode;
              const href = `/show/${ep.show.id}/season/${ep.seasonNumber}/episode/${ep.episodeNumber}`;
              const thumb = imageUrl(ep.show.posterPath, "w92");
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="w-8 shrink-0">
                    {thumb ? <Image src={thumb} alt="" width={92} height={138} className="rounded" /> : <div className="aspect-[2/3] rounded bg-background" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={href} className="font-medium hover:underline">
                      {ep.show.name} <span className="text-muted">S{ep.seasonNumber}E{ep.episodeNumber}</span> · {ep.name}
                    </Link>
                    {e.rewatch && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">Rewatch</span>}
                    {e.reviewText && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{e.reviewText}</p>}
                  </div>
                  {e.rating != null && <span className="text-sm font-semibold text-accent tabular-nums">{e.rating}%</span>}
                  {canEdit && (
                    <>
                      <EditLogEntry
                        entry={{ id: e.id, watchedOn: dateKey(e.watchedAt), rating: e.rating, reviewText: e.reviewText, rewatch: e.rewatch }}
                        today={today}
                      />
                      <form action={deleteLogEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <SubmitButton className="text-xs text-muted underline hover:text-red-600" pendingText="…">Remove</SubmitButton>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
