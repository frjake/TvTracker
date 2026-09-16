import "server-only";

import { FOLLOW_STATUS } from "./constants";
import { prisma } from "./db";
import { type FollowState, type ProfileOwner, type Viewer, canViewProfile } from "./policies";

export async function getFollowState(viewerId: string | null, ownerId: string): Promise<FollowState> {
  if (!viewerId || viewerId === ownerId) return "none";
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
    select: { status: true },
  });
  if (!follow) return "none";
  return follow.status === FOLLOW_STATUS.ACCEPTED ? "accepted" : "pending";
}

/** Convenience: resolves follow state then applies the policy. */
export async function viewerCanSee(viewer: Viewer, owner: ProfileOwner): Promise<boolean> {
  const state = await getFollowState(viewer?.id ?? null, owner.id);
  return canViewProfile(viewer, owner, state);
}

/**
 * Ids of users whose content the viewer may read: everyone public, plus private accounts
 * the viewer follows, plus the viewer. Used to filter review lists on item pages.
 */
export async function visibleAuthorFilter(viewerId: string | null) {
  const followed = viewerId
    ? await prisma.follow.findMany({
        where: { followerId: viewerId, status: FOLLOW_STATUS.ACCEPTED },
        select: { followingId: true },
      })
    : [];
  const allowedPrivateIds = followed.map((f) => f.followingId);
  if (viewerId) allowedPrivateIds.push(viewerId);
  return {
    OR: [{ user: { isPrivate: false } }, { userId: { in: allowedPrivateIds } }],
  };
}
