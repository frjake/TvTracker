import { unfollowUser } from "@/app/actions/follows";
import { UserList } from "@/components/UserList";
import { SubmitButton } from "@/components/forms";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";

export default async function FollowingPage(props: PageProps<"/u/[username]/following">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null;

  const rows = await prisma.follow.findMany({
    where: { followerId: ctx.owner.id, status: FOLLOW_STATUS.ACCEPTED },
    include: { following: { select: { id: true, username: true, displayName: true, isPrivate: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <UserList
      users={rows.map((r) => r.following)}
      emptyText="Not following anyone yet."
      renderAction={
        ctx.isSelf
          ? (u) => (
              <form action={unfollowUser}>
                <input type="hidden" name="userId" value={u.id} />
                <SubmitButton className="text-xs text-muted underline hover:text-red-600" pendingText="…">Unfollow</SubmitButton>
              </form>
            )
          : undefined
      }
    />
  );
}
