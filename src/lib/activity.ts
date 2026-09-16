import "server-only";

import { ACTIVITY_TYPE, FOLLOW_STATUS, type ActivityType } from "./constants";
import { prisma } from "./db";

interface ActivityInput {
  userId: string;
  type: ActivityType;
  episodeId?: number | null;
  seasonId?: number | null;
  listId?: string | null;
  logEntryId?: string | null;
  ratingId?: string | null;
  reviewId?: string | null;
}

/**
 * Writes a feed row. Re-rating or editing a review replaces the earlier row for that
 * rating/review so the feed shows one fresh entry instead of a pile of edits.
 */
export async function recordActivity(input: ActivityInput) {
  if (input.type === ACTIVITY_TYPE.RATING && input.ratingId) {
    await prisma.activity.deleteMany({ where: { ratingId: input.ratingId } });
  }
  if (input.type === ACTIVITY_TYPE.REVIEW && input.reviewId) {
    await prisma.activity.deleteMany({ where: { reviewId: input.reviewId } });
  }
  return prisma.activity.create({ data: input });
}

const feedInclude = {
  user: { select: { id: true, username: true, displayName: true, isPrivate: true } },
  episode: { include: { show: true } },
  season: { include: { show: true } },
  list: { include: { _count: { select: { items: true } } } },
  logEntry: true,
  rating: true,
  review: true,
} as const;

export type FeedItem = Awaited<ReturnType<typeof feedFor>>[number];

/** Activity from accounts the viewer follows (accepted only), newest first. */
export async function feedFor(viewerId: string, take = 50) {
  const follows = await prisma.follow.findMany({
    where: { followerId: viewerId, status: FOLLOW_STATUS.ACCEPTED },
    select: { followingId: true },
  });
  const ids = follows.map((f) => f.followingId);
  if (ids.length === 0) return [];

  return prisma.activity.findMany({
    where: { userId: { in: ids } },
    include: feedInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** One user's own activity (for profile pages). Caller must have checked visibility. */
export async function activityFor(userId: string, take = 30) {
  return prisma.activity.findMany({
    where: { userId },
    include: feedInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}
