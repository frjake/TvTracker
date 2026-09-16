import "server-only";

import { cache } from "react";
import { getCurrentUser } from "./auth";
import { prisma } from "./db";
import { canViewProfile } from "./policies";
import { getFollowState } from "./social";

/**
 * Everything a profile layout/page needs to decide what to show. Memoized per request so
 * the layout and the active tab page share one lookup.
 */
export const loadProfile = cache(async (usernameRaw: string) => {
  const username = usernameRaw.toLowerCase();
  const [owner, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true, bio: true, isPrivate: true, createdAt: true },
    }),
    getCurrentUser(),
  ]);
  if (!owner) return null;

  const followState = await getFollowState(viewer?.id ?? null, owner.id);
  const canView = canViewProfile(viewer, owner, followState);
  return { owner, viewer, followState, canView, isSelf: viewer?.id === owner.id };
});

export type ProfileContext = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
