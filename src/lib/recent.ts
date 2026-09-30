import "server-only";

import { prisma } from "./db";

/**
 * The user's most recently logged shows (diary entries only, not watched marks), newest
 * first, one per show, each with the latest logged episode of that show.
 */
export async function recentlyLoggedShows(userId: string, take = 12) {
  // GROUP BY in SQL so a long binge of one show can't crowd the others out of the window.
  const rows = await prisma.$queryRaw<{ showId: number | bigint }[]>`
    SELECT e.showId AS showId
    FROM LogEntry l JOIN Episode e ON e.id = l.episodeId
    WHERE l.userId = ${userId}
    GROUP BY e.showId
    ORDER BY MAX(l.watchedAt) DESC, MAX(l.createdAt) DESC
    LIMIT ${take}`;
  const showIds = rows.map((r) => Number(r.showId));

  const latest = await Promise.all(
    showIds.map((showId) =>
      prisma.logEntry.findFirst({
        where: { userId, episode: { showId } },
        orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }],
        include: { episode: { include: { show: true } } },
      }),
    ),
  );
  return latest.filter((e) => e != null);
}
