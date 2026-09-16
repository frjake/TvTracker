import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";

type Props = LayoutProps<"/u/[username]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const ctx = await loadProfile((await props.params).username);
  return { title: ctx ? ctx.owner.displayName ?? ctx.owner.username : "User" };
}

export default async function ProfileLayout(props: Props) {
  const { username } = await props.params;
  const ctx = await loadProfile(username);
  if (!ctx) notFound();
  const { owner, viewer, followState, canView, isSelf } = ctx;

  const [episodesWatched, logCount, reviewCount, listCount, followerCount, followingCount] = await Promise.all([
    prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*) AS n FROM (
        SELECT episodeId FROM WatchedMark WHERE userId = ${owner.id}
        UNION
        SELECT episodeId FROM LogEntry WHERE userId = ${owner.id}
      )`.then((r) => Number(r[0]?.n ?? 0)),
    prisma.logEntry.count({ where: { userId: owner.id } }),
    prisma.review.count({ where: { userId: owner.id } }),
    prisma.list.count({ where: { userId: owner.id } }),
    prisma.follow.count({ where: { followingId: owner.id, status: FOLLOW_STATUS.ACCEPTED } }),
    prisma.follow.count({ where: { followerId: owner.id, status: FOLLOW_STATUS.ACCEPTED } }),
  ]);

  const base = `/u/${owner.username}`;
  const tabs = [
    { href: base, label: "Activity" },
    { href: `${base}/log`, label: `Log (${logCount})` },
    { href: `${base}/reviews`, label: `Reviews (${reviewCount})` },
    { href: `${base}/lists`, label: `Lists (${listCount})` },
    { href: `${base}/followers`, label: `Followers (${followerCount})` },
    { href: `${base}/following`, label: `Following (${followingCount})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-accent">
          {owner.username[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {owner.displayName ?? owner.username}
            {owner.displayName && <span className="ml-2 text-base font-normal text-muted">{owner.username}</span>}
            {owner.isPrivate && <span className="ml-2 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted">Private</span>}
          </h1>
          {owner.bio && canView && <p className="mt-1 max-w-xl text-sm">{owner.bio}</p>}
          <p className="mt-2 text-sm text-muted">
            {episodesWatched} episode{episodesWatched === 1 ? "" : "s"} watched · joined {owner.createdAt.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSelf ? (
            <Link href="/settings" className="btn-secondary">Edit profile</Link>
          ) : (
            <FollowButton viewer={viewer} owner={owner} followState={followState} returnTo={base} />
          )}
        </div>
      </header>

      {canView ? (
        <>
          <nav className="flex flex-wrap gap-1 border-b border-line text-sm">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className="navlink -mb-px border-b-2 border-transparent px-3 py-2 hover:border-line">
                {t.label}
              </Link>
            ))}
          </nav>
          {props.children}
        </>
      ) : (
        <div className="card text-center text-sm text-muted">
          <p className="font-medium text-foreground">This account is private.</p>
          <p className="mt-1">
            {followState === "pending" ? "Your follow request is waiting for approval." : "Follow to see their log, reviews and lists."}
          </p>
        </div>
      )}
    </div>
  );
}
