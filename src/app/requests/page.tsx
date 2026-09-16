import { acceptFollowRequest, removeFollower } from "@/app/actions/follows";
import { UserList } from "@/components/UserList";
import { SubmitButton } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata = { title: "Follow requests" };

export default async function RequestsPage() {
  const me = await requireUser("/requests");
  const rows = await prisma.follow.findMany({
    where: { followingId: me.id, status: FOLLOW_STATUS.PENDING },
    include: { follower: { select: { id: true, username: true, displayName: true, isPrivate: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Follow requests</h1>
      {!me.isPrivate && (
        <p className="text-sm text-muted">Your account is public, so new followers are accepted automatically.</p>
      )}
      <UserList
        users={rows.map((r) => r.follower)}
        emptyText="No pending requests."
        renderAction={(u) => (
          <div className="flex gap-2">
            <form action={acceptFollowRequest}>
              <input type="hidden" name="userId" value={u.id} />
              <SubmitButton className="btn-primary" pendingText="…">Accept</SubmitButton>
            </form>
            <form action={removeFollower}>
              <input type="hidden" name="userId" value={u.id} />
              <SubmitButton className="btn-secondary" pendingText="…">Decline</SubmitButton>
            </form>
          </div>
        )}
      />
    </div>
  );
}
