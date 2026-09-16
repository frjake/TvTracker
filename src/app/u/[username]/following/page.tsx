import { unfollowUser } from "@/app/actions/follows";
import { FollowButton } from "@/components/FollowButton";
import { UserList } from "@/components/UserList";
import { SubmitButton } from "@/components/forms";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FollowState } from "@/lib/policies";
import { loadProfile } from "@/lib/profile";

type Props = PageProps<"/u/[username]/following">;

/** People matching the search box, with the viewer's follow state for each. */
async function searchUsers(query: string, viewerId: string | null) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: query } }, { displayName: { contains: query } }],
      ...(viewerId ? { id: { not: viewerId } } : {}),
    },
    select: { id: true, username: true, displayName: true, isPrivate: true },
    orderBy: { username: "asc" },
    take: 25,
  });
  const follows = viewerId
    ? await prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
        select: { followingId: true, status: true },
      })
    : [];
  const state = new Map<string, FollowState>(
    follows.map((f) => [f.followingId, f.status === FOLLOW_STATUS.ACCEPTED ? "accepted" : "pending"]),
  );
  return users.map((u) => ({ ...u, followState: state.get(u.id) ?? ("none" as FollowState) }));
}

export default async function FollowingPage(props: Props) {
  const [{ username }, sp] = await Promise.all([props.params, props.searchParams]);
  const ctx = await loadProfile(username);
  if (!ctx?.canView) return null;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const base = `/u/${ctx.owner.username}/following`;

  const [rows, results] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: ctx.owner.id, status: FOLLOW_STATUS.ACCEPTED },
      include: { following: { select: { id: true, username: true, displayName: true, isPrivate: true } } },
      orderBy: { createdAt: "desc" },
    }),
    query ? searchUsers(query, ctx.viewer?.id ?? null) : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <form method="get" action={base} className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Find people by username or name…"
            aria-label="Search users"
            className="input max-w-sm"
          />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
        {results && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted">
              {results.length === 0 ? `No one matches “${query}”.` : `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`}
            </h3>
            {results.length > 0 && (
              <UserList
                users={results}
                emptyText=""
                renderAction={(u) => {
                  const r = results.find((x) => x.id === u.id)!;
                  return <FollowButton viewer={ctx.viewer} owner={r} followState={r.followState} returnTo={`${base}?q=${encodeURIComponent(query)}`} />;
                }}
              />
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted">Following</h3>
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
      </section>
    </div>
  );
}
