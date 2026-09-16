import "server-only";

import { prisma } from "./db";
import { type Recommendation, type WatchEvent, buildSeeds, mergeCandidates } from "./recommend";
import { userShowAveragesFor } from "./scores";
import { getShowRecommendations } from "./tmdb";

export interface RecommendationSet {
  items: Recommendation[];
  /** Seed show names for the "Because you watched …" captions. */
  seedNames: Map<number, string>;
}

/**
 * Recommendations for the home page: recent watches (log entries + watched marks) become
 * weighted seed shows, TMDB suggests shows for each seed, and the lists are merged. Shows
 * the user has watched or put on a list are excluded. Computed per request; the TMDB
 * responses are cached for a day and shared across users.
 */
export async function recommendationsFor(userId: string): Promise<RecommendationSet> {
  const [logs, marks, listItems] = await Promise.all([
    prisma.logEntry.findMany({
      where: { userId },
      select: { watchedAt: true, episode: { select: { showId: true } } },
      orderBy: { watchedAt: "desc" },
      take: 5000,
    }),
    prisma.watchedMark.findMany({
      where: { userId },
      select: { createdAt: true, episode: { select: { showId: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.listItem.findMany({
      where: { list: { userId } },
      select: { episode: { select: { showId: true } }, season: { select: { showId: true } } },
    }),
  ]);

  const events: WatchEvent[] = [
    ...logs.map((l) => ({ showId: l.episode.showId, at: l.watchedAt })),
    ...marks.map((m) => ({ showId: m.episode.showId, at: m.createdAt })),
  ];
  if (events.length === 0) return { items: [], seedNames: new Map() };

  const watchedShowIds = [...new Set(events.map((e) => e.showId))];
  const ratings = await userShowAveragesFor(userId, watchedShowIds);
  const seeds = buildSeeds(
    events,
    new Map(watchedShowIds.map((id) => [id, ratings.get(id)?.average ?? null])),
    new Date(),
  );
  if (seeds.length === 0) return { items: [], seedNames: new Map() };

  const exclude = new Set<number>(watchedShowIds);
  for (const li of listItems) {
    const showId = li.episode?.showId ?? li.season?.showId;
    if (showId != null) exclude.add(showId);
  }

  const [lists, seedShows] = await Promise.all([
    Promise.all(
      seeds.map((seed) =>
        getShowRecommendations(seed.showId)
          .then((page) => ({ seed, results: page.results }))
          .catch(() => ({ seed, results: [] })), // one failed seed shouldn't sink the section
      ),
    ),
    prisma.show.findMany({ where: { id: { in: seeds.map((s) => s.showId) } }, select: { id: true, name: true } }),
  ]);

  return {
    items: mergeCandidates(lists, exclude),
    seedNames: new Map(seedShows.map((s) => [s.id, s.name])),
  };
}
