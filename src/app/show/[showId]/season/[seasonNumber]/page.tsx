import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { markSeasonWatched, unmarkSeasonWatched } from "@/app/actions/watch";
import { AddToListMenu } from "@/components/AddToListMenu";
import { CreditsSection } from "@/components/CreditsSection";
import { LogDialog } from "@/components/LogDialog";
import { RatingControl } from "@/components/RatingControl";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewList } from "@/components/ReviewList";
import { ScoreBadge } from "@/components/ScoreBadge";
import { SubmitButton, TargetFields } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeason } from "@/lib/cache";
import { ensureSeasonCredits } from "@/lib/credits";
import { todayString } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { scoreFrom, tmdbPercent } from "@/lib/ratings";
import { visibleReviewsFor } from "@/lib/reviews";
import { episodeAveragesForSeason, seasonScore } from "@/lib/scores";
import { imageUrl } from "@/lib/tmdb";

type Props = PageProps<"/show/[showId]/season/[seasonNumber]">;

async function load(props: Props) {
  const { showId, seasonNumber } = await props.params;
  const s = Number(showId);
  const n = Number(seasonNumber);
  if (!Number.isInteger(s) || s <= 0 || !Number.isInteger(n) || n < 0) return null;
  return ensureSeason(s, n);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const season = await load(props);
  return { title: season ? `${season.show.name} – ${season.name}` : "Season" };
}

export default async function SeasonPage(props: Props) {
  const season = await load(props);
  if (!season) notFound();
  const viewer = await getCurrentUser();
  const episodeIds = season.episodes.map((e) => e.id);

  const [score, episodeAverages, reviews, userRating, userReview, marks, logged, credits] = await Promise.all([
    seasonScore(season.id, season.tmdbVoteAverage),
    episodeAveragesForSeason(season.id),
    visibleReviewsFor({ seasonId: season.id }, viewer?.id ?? null),
    viewer ? prisma.rating.findUnique({ where: { userId_seasonId: { userId: viewer.id, seasonId: season.id } } }) : null,
    viewer ? prisma.review.findUnique({ where: { userId_seasonId: { userId: viewer.id, seasonId: season.id } } }) : null,
    viewer ? prisma.watchedMark.findMany({ where: { userId: viewer.id, episodeId: { in: episodeIds } }, select: { episodeId: true } }) : [],
    viewer ? prisma.logEntry.findMany({ where: { userId: viewer.id, episodeId: { in: episodeIds } }, select: { episodeId: true }, distinct: ["episodeId"] }) : [],
    ensureSeasonCredits(season.showId, season.seasonNumber).catch(() => []),
  ]);

  const watched = new Set<number>([...marks.map((m) => m.episodeId), ...logged.map((l) => l.episodeId)]);
  const allWatched = episodeIds.length > 0 && episodeIds.every((id) => watched.has(id));
  const poster = imageUrl(season.posterPath ?? season.show.posterPath, "w342");
  const base = `/show/${season.showId}/season/${season.seasonNumber}`;

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-muted">
        <Link href={`/show/${season.showId}`} className="hover:underline">{season.show.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{season.name}</span>
      </nav>

      <section className="flex flex-col gap-5 sm:flex-row">
        <div className="w-32 shrink-0 sm:w-44">
          {poster ? (
            <Image src={poster} alt="" width={342} height={513} className="rounded-md border border-line" />
          ) : (
            <div className="aspect-[2/3] rounded-md border border-line bg-surface" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{season.name}</h1>
          <p className="text-sm text-muted">
            {season.episodes.length} episodes{season.airDate && ` · ${season.airDate.slice(0, 4)}`}
            {viewer && ` · ${watched.size}/${season.episodes.length} watched`}
          </p>
          <ScoreBadge score={score} tmdbPercent={tmdbPercent(season.tmdbVoteAverage)} size="lg" />
          {season.overview && <p className="max-w-2xl text-sm leading-relaxed">{season.overview}</p>}

          {viewer ? (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <form action={allWatched ? unmarkSeasonWatched : markSeasonWatched}>
                <TargetFields showId={season.showId} seasonNumber={season.seasonNumber} />
                <SubmitButton className={allWatched ? "btn-secondary border-accent text-accent" : "btn-secondary"} pendingText="Saving…">
                  {allWatched ? "✓ All watched" : "Mark all watched"}
                </SubmitButton>
              </form>
              <LogDialog showId={season.showId} seasonNumber={season.seasonNumber} today={todayString()} episodeCount={season.episodes.length} alreadyWatched={allWatched} />
              <AddToListMenu userId={viewer.id} showId={season.showId} seasonNumber={season.seasonNumber} seasonId={season.id} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              <Link href={`/login?next=${encodeURIComponent(base)}`} className="underline">Log in</Link> to track, rate or review this season.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Episodes</h2>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Aired</th>
                <th className="px-3 py-2">Score</th>
                {viewer && <th className="px-3 py-2 text-center">Seen</th>}
              </tr>
            </thead>
            <tbody>
              {season.episodes.map((ep) => {
                const agg = episodeAverages.get(ep.id);
                const epScore = scoreFrom(agg?.average, agg?.count ?? 0, ep.tmdbVoteAverage);
                return (
                  <tr key={ep.id} className="border-t border-line hover:bg-surface">
                    <td className="px-3 py-2 tabular-nums text-muted">{ep.episodeNumber}</td>
                    <td className="px-3 py-2">
                      <Link href={`${base}/episode/${ep.episodeNumber}`} className="font-medium hover:underline">{ep.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{ep.airDate ?? "—"}</td>
                    <td className="px-3 py-2"><ScoreBadge score={epScore} size="sm" /></td>
                    {viewer && (
                      <td className="px-3 py-2 text-center text-accent" aria-label={watched.has(ep.id) ? "Watched" : "Not watched"}>
                        {watched.has(ep.id) ? "✓" : ""}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {viewer && (
        <section className="grid gap-4 lg:grid-cols-2">
          <RatingControl key={userRating?.value ?? "unrated"} showId={season.showId} seasonNumber={season.seasonNumber} current={userRating?.value ?? null} label="Your season rating" />
          <ReviewForm
            showId={season.showId}
            seasonNumber={season.seasonNumber}
            existing={userReview ? { id: userReview.id, body: userReview.body, containsSpoilers: userReview.containsSpoilers } : null}
          />
        </section>
      )}

      <CreditsSection credits={credits} seeAllHref={`${base}/cast`} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Season reviews</h2>
        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}
