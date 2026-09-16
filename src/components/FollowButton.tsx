import Link from "next/link";
import { followUser, unfollowUser } from "@/app/actions/follows";
import { type FollowState, type ProfileOwner, type Viewer, followActionFor } from "@/lib/policies";
import { SubmitButton } from "./forms";

export function FollowButton({
  viewer,
  owner,
  followState,
  returnTo,
}: {
  viewer: Viewer;
  owner: ProfileOwner & { username: string };
  followState: FollowState;
  returnTo: string;
}) {
  const action = followActionFor(viewer, owner, followState);

  switch (action) {
    case "self":
      return null;
    case "login":
      return (
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-primary">
          Log in to follow
        </Link>
      );
    case "follow":
    case "request":
      return (
        <form action={followUser}>
          <input type="hidden" name="userId" value={owner.id} />
          <SubmitButton className="btn-primary" pendingText="…">
            {action === "request" ? "Request to follow" : "Follow"}
          </SubmitButton>
        </form>
      );
    case "pending":
      return (
        <form action={unfollowUser}>
          <input type="hidden" name="userId" value={owner.id} />
          <SubmitButton className="btn-secondary" pendingText="…" title="Cancel request">
            Requested · Cancel
          </SubmitButton>
        </form>
      );
    case "unfollow":
      return (
        <form action={unfollowUser}>
          <input type="hidden" name="userId" value={owner.id} />
          <SubmitButton className="btn-secondary" pendingText="…">
            Following · Unfollow
          </SubmitButton>
        </form>
      );
  }
}
