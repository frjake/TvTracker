import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteLogEntry } from "@/app/actions/watch";
import { AddToListMenu } from "@/components/AddToListMenu";
import { CreditsSection } from "@/components/CreditsSection";
import { EditLogEntry } from "@/components/EditLogEntry";
import { LogDialog } from "@/components/LogDialog";
import { RatingControl } from "@/components/RatingControl";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewList } from "@/components/ReviewList";
import { ScoreBadge } from "@/components/ScoreBadge";
import { WatchedToggle } from "@/components/WatchedToggle";
import { SubmitButton } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";
import { ensureEpisode } from "@/lib/cache";
import { ensureEpisodeCredits } from "@/lib/credits";
import { dateKey, formatDate, todayString } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { tmdbPercent } from "@/lib/ratings";
import { visibleReviewsFor } from "@/lib/reviews";
import { episodeScore } from "@/lib/scores";
import { imageUrl } from "@/lib/tmdb";

type Props = PageProps<"/show/[showId]/season/[seasonNumber]/episode/[episodeNumber]">;

async function load(props: Props) {
  const p = await props.params;
  const [s, n, e] = [Number(p.showId), Number(p.seasonNumber), Number(p.episodeNumber)];
  if (![s, n, e].every(Number.isInteger) || s <= 0 || n < 0 || e <= 0) return null;
  return ensureEpisode(s, n, e);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const ep = await load(props);
  return { title: ep ? `${ep.season.show.name} S${ep.seasonNumber}E${ep.episodeNumber} – ${ep.name}` : "Episode" };
}

export default async function EpisodePage(props: Props) {
  const ep = await load(props);
  if (!ep) notFound();
  const viewer = await getCurrentUser();
  const { season } = ep;
  const show = season.show;

  const [score, reviews, userRating, userReview, watchedMark, userLogs, credits] = await Promise.all([
    episodeScore(ep.id, ep.tmdbVoteAverage),
    visibleReviewsFor({ episodeId: ep.id }, viewer?.id ?? null),
    viewer ? prisma.rating.findUnique({ where: { userId_episodeId: { userId: viewer.id, episodeId: ep.id } } }) : null,
    viewer ? prisma.review.findUnique({ where: { userId_episodeId: { userId: viewer.id, episodeId: ep.id } } }) : null,
    viewer ? prisma.watchedMark.findUnique({ where: { userId_episodeId: { userId: viewer.id, episodeId: ep.id } } }) : null,
    viewer
      ? prisma.logEntry.findMany({ where: { userId: viewer.id, episodeId: ep.id }, orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }] })
      : [],
    ensureEpisodeCredits(show.id, season.seasonNumber, ep.episodeNumber).catch(() => []),
  ]);

  const idx = season.episodes.findIndex((x) => x.id === ep.id);
  const prev = idx > 0 ? season.episodes[idx - 1] : null;
  const next = idx >= 0 && idx < season.episodes.length - 1 ? season.episodes[idx + 1] : null;
  const still = imageUrl(ep.stillPath, "w780");
  const base = `/show/${show.id}/season/${season.seasonNumber}`;
  const code = `S${ep.seasonNumber}E${ep.episodeNumber}`;

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-muted">
        <Link href={`/show/${show.id}`} className="hover:underline">{show.name}</Link>
        <span className="mx-2">/</span>
        <Link href={base} className="hover:underline">{season.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{code}</span>
      </nav>

      <section className="flex flex-col gap-5 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[420px]">
          {still ? (
            <Image src={still} alt="" width={780} height={439} priority className="w-full rounded-md border border-line" />
          ) : (
            <div className="aspect-video rounded-md border border-line bg-surface" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm font-medium text-accent">{code}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{ep.name}</h1>
          <p className="text-sm text-muted">
            {ep.airDate ? `Aired ${ep.airDate}` : "Air date unknown"}
            {ep.runtime ? ` · ${ep.runtime} min` : ""}
          </p>
          <ScoreBadge score={score} tmdbPercent={tmdbPercent(ep.tmdbVoteAverage)} size="lg" />
          {ep.overview && <p className="max-w-2xl text-sm leading-relaxed">{ep.overview}</p>}

          {viewer ? (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <WatchedToggle
                showId={show.id}
                seasonNumber={season.seasonNumber}
                episodeNumber={ep.episodeNumber}
                watched={!!watchedMark || userLogs.length > 0}
                viaLog={userLogs.length > 0}
              />
              <LogDialog
                showId={show.id}
                seasonNumber={season.seasonNumber}
                episodeNumber={ep.episodeNumber}
                today={todayString()}
                alreadyWatched={!!watchedMark || userLogs.length > 0}
              />
              <AddToListMenu userId={viewer.id} showId={show.id} seasonNumber={season.seasonNumber} episodeNumber={ep.episodeNumber} episodeId={ep.id} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              <Link href={`/login?next=${encodeURIComponent(`${base}/episode/${ep.episodeNumber}`)}`} className="underline">Log in</Link> to log, rate or review this episode.
            </p>
          )}
        </div>
      </section>

      <div className="flex justify-between text-sm">
        {prev ? <Link href={`${base}/episode/${prev.episodeNumber}`} className="navlink">← E{prev.episodeNumber} {prev.name}</Link> : <span />}
        {next ? <Link href={`${base}/episode/${next.episodeNumber}`} className="navlink">E{next.episodeNumber} {next.name} →</Link> : <span />}
      </div>

      {viewer && (
        <section className="grid gap-4 lg:grid-cols-2">
          <RatingControl
            key={userRating?.value ?? "unrated"}
            showId={show.id}
            seasonNumber={season.seasonNumber}
            episodeNumber={ep.episodeNumber}
            current={userRating?.value ?? null}
            label="Your rating"
          />
          <ReviewForm
            showId={show.id}
            seasonNumber={season.seasonNumber}
            episodeNumber={ep.episodeNumber}
            existing={userReview ? { id: userReview.id, body: userReview.body, containsSpoilers: userReview.containsSpoilers } : null}
          />
        </section>
      )}

      {viewer && userLogs.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Your log</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {userLogs.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  Watched {formatDate(entry.watchedAt)}
                  {entry.rewatch && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">Rewatch</span>}
                  {entry.rating != null && <span className="ml-2 font-semibold text-accent">{entry.rating}%</span>}
                  {entry.reviewText && <span className="ml-2 line-clamp-1 text-xs text-muted">{entry.reviewText}</span>}
                </span>
                <EditLogEntry
                  entry={{ id: entry.id, watchedOn: dateKey(entry.watchedAt), rating: entry.rating, reviewText: entry.reviewText, rewatch: entry.rewatch }}
                  today={todayString()}
                />
                <form action={deleteLogEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <SubmitButton className="text-xs text-muted underline hover:text-red-600" pendingText="Removing…">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreditsSection credits={credits} castLimit={30} withGuests />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}
