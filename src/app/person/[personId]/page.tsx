import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { scanSeason, scanShow } from "@/app/actions/credits";
import { ScoreBadge } from "@/components/ScoreBadge";
import { SortFilterBar } from "@/components/SortFilterBar";
import { SubmitButton } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_KIND, SCAN_MAX_EPISODES } from "@/lib/constants";
import { ensurePerson, ensurePersonFilmography } from "@/lib/credits";
import { prisma } from "@/lib/db";
import {
  type EpisodeRow,
  type ShowRow,
  filterShows,
  groupShowRows,
  parseFilmographyQuery,
  prepareEpisodes,
  prepareShows,
  parseGenreIds,
  progressState,
  yearOf,
} from "@/lib/people";
import { scoreFrom } from "@/lib/ratings";
import { showAveragesFor, userShowAveragesFor, watchedCountsFor } from "@/lib/scores";
import { imageUrl } from "@/lib/tmdb";

type Props = PageProps<"/person/[personId]">;

async function load(props: Props) {
  const id = Number((await props.params).personId);
  return Number.isInteger(id) && id > 0 ? ensurePerson(id) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const person = await load(props);
  return { title: person?.name ?? "Person" };
}

function Pct({ value, count }: { value: number | null; count?: number }) {
  if (value == null) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="font-semibold text-accent tabular-nums">
      {Math.round(value)}%{count != null && count > 0 && <span className="ml-1 text-xs font-normal text-muted">({count})</span>}
    </span>
  );
}

export default async function PersonPage(props: Props) {
  const person = await load(props);
  if (!person) notFound();
  const [viewer, sp] = await Promise.all([getCurrentUser(), props.searchParams]);
  const q = parseFilmographyQuery(sp);
  const base = `/person/${person.id}`;

  const filmography = await ensurePersonFilmography(person).catch(() => []);
  const showIds = [...new Set(filmography.map((f) => f.showId))];

  const [cachedShows, communityAvg, yourAvg, watchedCounts, billingRows, episodeCredits] = await Promise.all([
    prisma.show.findMany({
      where: { id: { in: showIds } },
      select: {
        id: true,
        numberOfEpisodes: true,
        episodeCreditsScannedAt: true,
        seasons: { select: { seasonNumber: true, name: true, episodeCount: true, episodeCreditsScannedAt: true }, orderBy: { seasonNumber: "asc" } },
      },
    }),
    showAveragesFor(showIds),
    viewer ? userShowAveragesFor(viewer.id, showIds) : new Map<number, { average: number | null; count: number }>(),
    viewer ? watchedCountsFor(viewer.id, showIds) : new Map<number, number>(),
    prisma.credit.findMany({
      where: { personId: person.id, seasonId: null, episodeId: null, kind: CREDIT_KIND.CAST, order: { not: null } },
      select: { showId: true, order: true },
    }),
    prisma.credit.findMany({
      where: { personId: person.id, episodeId: { not: null } },
      include: { episode: { include: { show: { select: { id: true, name: true } } } } },
    }),
  ]);

  const showById = new Map(cachedShows.map((s) => [s.id, s]));
  const billing = new Map<number, number>();
  for (const b of billingRows) if (b.order != null) billing.set(b.showId, Math.min(b.order, billing.get(b.showId) ?? Infinity));

  const showRows: ShowRow[] = filmography.map((f) => {
    const cached = showById.get(f.showId);
    return {
      creditId: f.id,
      showId: f.showId,
      name: f.showName,
      posterPath: f.posterPath,
      firstAirDate: f.firstAirDate,
      kind: f.kind === CREDIT_KIND.CREW ? "crew" : "cast",
      role: f.character ?? f.job ?? "",
      department: f.department,
      episodeCount: f.episodeCount,
      genreIds: parseGenreIds(f.genreIds),
      tmdbVoteAverage: f.tmdbVoteAverage,
      communityScore: communityAvg.get(f.showId)?.average ?? null,
      communityCount: communityAvg.get(f.showId)?.count ?? 0,
      yourScore: yourAvg.get(f.showId)?.average ?? null,
      billing: billing.get(f.showId) ?? null,
      watchedCount: watchedCounts.get(f.showId) ?? 0,
      totalEpisodes: cached?.numberOfEpisodes ?? null,
      cached: !!cached,
      scanned: !!cached?.episodeCreditsScannedAt,
    };
  });
  const shows = prepareShows(showRows, q);

  // ---- episodes ----
  const episodeIds = [...new Set(episodeCredits.map((c) => c.episodeId!))];
  const [epAvgRows, yourEpRatings, marks, logs] = await Promise.all([
    prisma.rating.groupBy({ by: ["episodeId"], where: { episodeId: { in: episodeIds } }, _avg: { value: true }, _count: { value: true } }),
    viewer ? prisma.rating.findMany({ where: { userId: viewer.id, episodeId: { in: episodeIds } }, select: { episodeId: true, value: true } }) : [],
    viewer ? prisma.watchedMark.findMany({ where: { userId: viewer.id, episodeId: { in: episodeIds } }, select: { episodeId: true } }) : [],
    viewer ? prisma.logEntry.findMany({ where: { userId: viewer.id, episodeId: { in: episodeIds } }, select: { episodeId: true }, distinct: ["episodeId"] }) : [],
  ]);
  const epAvg = new Map(epAvgRows.map((r) => [r.episodeId!, { average: r._avg.value, count: r._count.value }]));
  const yourEp = new Map(yourEpRatings.map((r) => [r.episodeId!, r.value]));
  const seen = new Set([...marks.map((m) => m.episodeId), ...logs.map((l) => l.episodeId)]);

  const episodeRows: EpisodeRow[] = episodeCredits.map((c) => ({
    creditId: c.id,
    episodeId: c.episode!.id,
    showId: c.episode!.show.id,
    showName: c.episode!.show.name,
    seasonNumber: c.episode!.seasonNumber,
    episodeNumber: c.episode!.episodeNumber,
    title: c.episode!.name,
    airDate: c.episode!.airDate,
    kind: c.kind as EpisodeRow["kind"],
    role: c.character ?? c.job ?? "",
    billing: c.order,
    tmdbVoteAverage: c.episode!.tmdbVoteAverage,
    communityScore: epAvg.get(c.episode!.id)?.average ?? null,
    communityCount: epAvg.get(c.episode!.id)?.count ?? 0,
    yourScore: yourEp.get(c.episode!.id) ?? null,
    watched: seen.has(c.episode!.id),
  }));
  const episodes = prepareEpisodes(episodeRows, q);
  const episodeShowOptions = [...new Map(episodeRows.map((r) => [r.showId, { id: r.showId, name: r.showName }])).values()].sort((a, b) => a.name.localeCompare(b.name));

  const photo = imageUrl(person.profilePath, "w342");
  const neutral = { ...q, watched: "any" as const, from: null, to: null, dept: "all" as const };
  const allShows = groupShowRows(filterShows(showRows, { ...neutral, all: true }), { ...neutral, singles: true }).length;
  const hiddenCount = allShows - groupShowRows(filterShows(showRows, neutral), neutral).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 sm:flex-row">
        <div className="w-32 shrink-0 sm:w-44">
          {photo ? (
            <Image src={photo} alt="" width={342} height={513} priority className="rounded-md border border-line" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-md border border-line bg-accent-soft text-4xl font-semibold text-accent">{person.name[0]}</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{person.name}</h1>
          <p className="text-sm text-muted">
            {person.knownForDepartment && <span>{person.knownForDepartment}</span>}
            {person.birthday && <span> · Born {person.birthday}{person.placeOfBirth ? `, ${person.placeOfBirth}` : ""}</span>}
            {person.deathday && <span> · Died {person.deathday}</span>}
          </p>
          {person.biography && (
            person.biography.length > 400 ? (
              <details className="text-sm leading-relaxed">
                <summary className="cursor-pointer text-muted">{person.biography.slice(0, 400)}… <span className="text-accent">more</span></summary>
                <p className="mt-2 whitespace-pre-wrap">{person.biography}</p>
              </details>
            ) : (
              <p className="text-sm leading-relaxed">{person.biography}</p>
            )
          )}
        </div>
      </section>

      {/* ---------- shows ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Shows <span className="text-sm font-normal text-muted">({shows.length}{hiddenCount > 0 ? ` shown · ${hiddenCount} hidden by default filters` : ""})</span>
        </h2>
        <SortFilterBar q={q} section="shows" signedIn={!!viewer} />
        {shows.length === 0 ? (
          <p className="text-sm text-muted">No shows match these filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Show</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Eps</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Score</th>
                  {viewer && <th className="px-3 py-2">Yours</th>}
                  {viewer && <th className="px-3 py-2">Progress</th>}
                  <th className="px-3 py-2">Billing</th>
                  {viewer && <th className="px-3 py-2">Episodes</th>}
                </tr>
              </thead>
              <tbody>
                {shows.map((r) => {
                  const poster = imageUrl(r.posterPath, "w92");
                  const cached = showById.get(r.showId);
                  const state = progressState(r.watchedCount, r.totalEpisodes);
                  const tooBig = (cached?.numberOfEpisodes ?? 0) > SCAN_MAX_EPISODES;
                  return (
                    <tr key={r.creditId} className="border-t border-line align-top hover:bg-surface">
                      <td className="px-3 py-2">
                        <Link href={`/show/${r.showId}`} className="flex items-center gap-2 font-medium hover:underline">
                          <span className="w-7 shrink-0">
                            {poster ? <Image src={poster} alt="" width={92} height={138} className="rounded" /> : <span className="block aspect-[2/3] rounded bg-background" />}
                          </span>
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {r.role}{r.kind === "crew" && r.department ? <span className="text-xs"> · {r.department}</span> : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.episodeCount}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">{yearOf(r.firstAirDate) ?? "—"}</td>
                      <td className="px-3 py-2"><ScoreBadge score={scoreFrom(r.communityScore, r.communityCount, r.tmdbVoteAverage)} size="sm" /></td>
                      {viewer && <td className="px-3 py-2"><Pct value={r.yourScore} /></td>}
                      {viewer && (
                        <td className="px-3 py-2 text-xs text-muted">
                          {state === "completed" ? <span className="text-accent">✓ Completed</span> : r.totalEpisodes != null ? `${r.watchedCount} / ${r.totalEpisodes}` : r.watchedCount > 0 ? `${r.watchedCount} watched` : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 tabular-nums text-muted">{r.billing != null ? `#${r.billing + 1}` : "—"}</td>
                      {viewer && (
                        <td className="px-3 py-2">
                          {r.scanned ? (
                            <Link href={`${base}?eshow=${r.showId}#episodes`} className="text-xs text-accent hover:underline">✓ scanned</Link>
                          ) : tooBig && cached ? (
                            <details>
                              <summary className="cursor-pointer text-xs text-muted">Per season ({cached.numberOfEpisodes} eps)</summary>
                              <ul className="mt-1 flex flex-col gap-1">
                                {cached.seasons.map((s) => (
                                  <li key={s.seasonNumber} className="flex items-center gap-2 text-xs">
                                    <span className="w-20 truncate">{s.name}</span>
                                    {s.episodeCreditsScannedAt ? (
                                      <span className="text-accent">✓</span>
                                    ) : (
                                      <form action={scanSeason}>
                                        <input type="hidden" name="showId" value={r.showId} />
                                        <input type="hidden" name="seasonNumber" value={s.seasonNumber} />
                                        <SubmitButton className="text-accent underline" pendingText="Scanning…">Scan ({s.episodeCount ?? "?"})</SubmitButton>
                                      </form>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <form action={scanShow}>
                              <input type="hidden" name="showId" value={r.showId} />
                              <SubmitButton className="text-xs text-accent underline" pendingText="Scanning…">Find their episodes</SubmitButton>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- episodes ---------- */}
      <section className="flex flex-col gap-3" id="episodes">
        <h2 className="text-lg font-semibold">
          Episodes <span className="text-sm font-normal text-muted">({episodes.length}{episodeIds.length !== episodes.length ? ` of ${episodeIds.length}` : ""})</span>
        </h2>
        {episodeRows.length === 0 ? (
          <p className="card text-sm text-muted">
            No episode appearances cached yet. Episodes appear here once someone opens them, or when you use “Find their episodes” on a show above{viewer ? "" : " (log in)"}.
          </p>
        ) : (
          <>
            <SortFilterBar q={q} section="episodes" signedIn={!!viewer} showOptions={episodeShowOptions} />
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Episode</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Aired</th>
                    <th className="px-3 py-2">Score</th>
                    {viewer && <th className="px-3 py-2">Yours</th>}
                    {viewer && <th className="px-3 py-2 text-center">Seen</th>}
                    <th className="px-3 py-2">Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map((r) => (
                    <tr key={r.creditId} className="border-t border-line hover:bg-surface">
                      <td className="px-3 py-2">
                        <Link href={`/show/${r.showId}/season/${r.seasonNumber}/episode/${r.episodeNumber}`} className="font-medium hover:underline">
                          {r.showName} <span className="text-muted">S{r.seasonNumber}E{r.episodeNumber}</span> · {r.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">{r.role}{r.kind === "guest" ? <span className="text-xs"> · guest</span> : null}</td>
                      <td className="px-3 py-2 text-muted">{r.airDate ?? "—"}</td>
                      <td className="px-3 py-2"><ScoreBadge score={scoreFrom(r.communityScore, r.communityCount, r.tmdbVoteAverage)} size="sm" /></td>
                      {viewer && <td className="px-3 py-2"><Pct value={r.yourScore} /></td>}
                      {viewer && <td className="px-3 py-2 text-center text-accent">{r.watched ? "✓" : ""}</td>}
                      <td className="px-3 py-2 tabular-nums text-muted">{r.billing != null ? `#${r.billing + 1}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
