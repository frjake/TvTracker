import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditsSection } from "@/components/CreditsSection";
import { ProgressLabel } from "@/components/ProgressLabel";
import { ScoreBadge } from "@/components/ScoreBadge";
import { getCurrentUser } from "@/lib/auth";
import { ensureShow } from "@/lib/cache";
import { ensureShowCredits } from "@/lib/credits";
import { scoreFrom, tmdbPercent } from "@/lib/ratings";
import { seasonAveragesForShow, seasonWatchedCountsFor, showScore, watchedCountsFor } from "@/lib/scores";
import { imageUrl } from "@/lib/tmdb";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata(props: PageProps<"/show/[showId]">): Promise<Metadata> {
  const id = parseId((await props.params).showId);
  const show = id ? await ensureShow(id) : null;
  return { title: show?.name ?? "Show" };
}

export default async function ShowPage(props: PageProps<"/show/[showId]">) {
  const id = parseId((await props.params).showId);
  if (!id) notFound();
  const show = await ensureShow(id);
  if (!show) notFound();

  const viewer = await getCurrentUser();
  const [averages, score, credits, showWatched, seasonWatched] = await Promise.all([
    seasonAveragesForShow(show.id),
    showScore(show.id, show.tmdbVoteAverage),
    ensureShowCredits(show.id).catch(() => []),
    viewer ? watchedCountsFor(viewer.id, [show.id]) : new Map<number, number>(),
    viewer ? seasonWatchedCountsFor(viewer.id, show.seasons.map((s) => s.id)) : new Map<number, { watched: number; total: number }>(),
  ]);
  const poster = imageUrl(show.posterPath, "w342");
  const backdrop = imageUrl(show.backdropPath, "w1280");
  const year = show.firstAirDate?.slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-lg border border-line">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-25" sizes="(max-width: 1152px) 100vw, 1152px" />
        )}
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row">
          <div className="w-32 shrink-0 sm:w-44">
            {poster ? (
              <Image src={poster} alt={`${show.name} poster`} width={342} height={513} className="rounded-md border border-line" />
            ) : (
              <div className="aspect-[2/3] rounded-md border border-line bg-surface" />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {show.name} {year && <span className="text-xl font-normal text-muted">({year})</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              {show.status && <span>{show.status}</span>}
              {show.numberOfSeasons != null && <span>{show.numberOfSeasons} season{show.numberOfSeasons === 1 ? "" : "s"}</span>}
            </div>
            <ScoreBadge score={score} tmdbPercent={tmdbPercent(show.tmdbVoteAverage)} size="lg" />
            {viewer && <ProgressLabel watched={showWatched.get(show.id) ?? 0} total={show.numberOfEpisodes} />}
            {show.overview && <p className="max-w-2xl text-sm leading-relaxed">{show.overview}</p>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {show.seasons.map((season) => {
            const agg = averages.get(season.id);
            const score = scoreFrom(agg?.average, agg?.count ?? 0, season.tmdbVoteAverage);
            const sPoster = imageUrl(season.posterPath, "w185");
            return (
              <li key={season.id}>
                <Link href={`/show/${show.id}/season/${season.seasonNumber}`} className="card flex gap-4 hover:border-accent">
                  <div className="w-16 shrink-0">
                    {sPoster ? (
                      <Image src={sPoster} alt="" width={185} height={278} className="rounded" />
                    ) : (
                      <div className="aspect-[2/3] rounded bg-background" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{season.name}</p>
                    <p className="text-xs text-muted">
                      {season.episodeCount ?? "?"} episodes{season.airDate && ` · ${season.airDate.slice(0, 4)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <ScoreBadge score={score} tmdbPercent={tmdbPercent(season.tmdbVoteAverage)} size="sm" />
                      {viewer && (
                        <ProgressLabel
                          watched={seasonWatched.get(season.id)?.watched ?? 0}
                          total={seasonWatched.get(season.id)?.total || season.episodeCount}
                          compact
                        />
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <CreditsSection credits={credits} seeAllHref={`/show/${show.id}/cast`} />
    </div>
  );
}
