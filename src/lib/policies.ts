// Pure authorization rules. The single source of truth for who may see what;
// used by pages AND server actions. No server imports so these are unit-testable.

export type Viewer = { id: string } | null;
export type ProfileOwner = { id: string; isPrivate: boolean };
export type FollowState = "none" | "pending" | "accepted";

/** Profiles, logs, reviews and lists of a private account are visible only to accepted followers. */
export function canViewProfile(viewer: Viewer, owner: ProfileOwner, followState: FollowState): boolean {
  if (!owner.isPrivate) return true;
  if (viewer && viewer.id === owner.id) return true;
  return followState === "accepted";
}

/** Review text follows the author's profile visibility. Ratings still count in averages regardless. */
export const canViewReview = canViewProfile;

export type FollowAction = "self" | "login" | "follow" | "request" | "pending" | "unfollow";

/** What the follow button should offer the viewer for this owner. */
export function followActionFor(viewer: Viewer, owner: ProfileOwner, followState: FollowState): FollowAction {
  if (!viewer) return "login";
  if (viewer.id === owner.id) return "self";
  if (followState === "accepted") return "unfollow";
  if (followState === "pending") return "pending";
  return owner.isPrivate ? "request" : "follow";
}

/** Only the owner may edit a list, log entry, rating or review. */
export function canEdit(viewer: Viewer, ownerId: string): boolean {
  return !!viewer && viewer.id === ownerId;
}
