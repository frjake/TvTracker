import "server-only";

import type { ReviewListItem } from "@/components/ReviewList";
import { prisma } from "./db";
import { visibleAuthorFilter } from "./social";

/** Reviews on an episode or season the viewer is allowed to read, with each author's rating. */
export async function visibleReviewsFor(
  target: { episodeId: number } | { seasonId: number },
  viewerId: string | null,
): Promise<ReviewListItem[]> {
  const reviews = await prisma.review.findMany({
    where: { ...target, ...(await visibleAuthorFilter(viewerId)) },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (reviews.length === 0) return [];

  const ratings = await prisma.rating.findMany({
    where: { ...target, userId: { in: reviews.map((r) => r.userId) } },
    select: { userId: true, value: true },
  });
  const byUser = new Map(ratings.map((r) => [r.userId, r.value]));

  return reviews.map((r) => ({
    id: r.id,
    body: r.body,
    containsSpoilers: r.containsSpoilers,
    updatedAt: r.updatedAt,
    user: r.user,
    rating: byUser.get(r.userId) ?? null,
  }));
}
