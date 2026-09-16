import Link from "next/link";
import { Suspense } from "react";
import { ActivityItem } from "@/components/ActivityItem";
import { Recommendations, RecommendationsSkeleton } from "@/components/Recommendations";
import { ShowCard, ShowGrid } from "@/components/ShowCard";
import { UserList } from "@/components/UserList";
import { feedFor } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { trendingTv } from "@/lib/tmdb";

async function Trending() {
  let shows;
  try {
    shows = (await trendingTv()).results.slice(0, 12);
  } catch (err) {
    return (
      <p className="card text-sm text-muted">
        Couldn&apos;t load trending shows: {err instanceof Error ? err.message : "unknown error"}
      </p>
    );
  }
  return (
    <ShowGrid>
      {shows.map((s) => (
        <ShowCard key={s.id} id={s.id} name={s.name} posterPath={s.poster_path} firstAirDate={s.first_air_date} />
      ))}
    </ShowGrid>
  );
}

async function Feed({ userId }: { userId: string }) {
  const items = await feedFor(userId);
  if (items.length > 0) {
    return (
      <ul className="flex flex-col gap-3">
        {items.map((a) => <ActivityItem key={a.id} activity={a} />)}
      </ul>
    );
  }

  // Nothing to show yet: suggest some people to follow.
  const people = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true, username: true, displayName: true, isPrivate: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return (
    <div className="card flex flex-col gap-3">
      <p className="text-sm text-muted">
        Your feed shows what the people you follow are watching, rating and reviewing. Follow someone to get started.
      </p>
      <UserList users={people} emptyText="No other members yet — invite a friend!" />
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-10">
      {user ? (
        <section>
          <h1 className="mb-3 text-lg font-semibold">Your feed</h1>
          <Feed userId={user.id} />
        </section>
      ) : (
        <section className="card flex flex-col items-start gap-3 py-8">
          <h1 className="text-3xl font-semibold tracking-tight">Keep track of the TV you watch.</h1>
          <p className="max-w-xl text-muted">
            Log episodes by day, rate and review episodes or whole seasons, build lists, and follow friends to see what they think.
          </p>
          <div className="flex gap-3">
            <Link href="/register" className="btn-primary">Get started</Link>
            <Link href="/login" className="btn-secondary">Log in</Link>
          </div>
        </section>
      )}

      {user && (
        <Suspense fallback={<RecommendationsSkeleton />}>
          <Recommendations userId={user.id} />
        </Suspense>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Trending this week</h2>
        <Trending />
      </section>
    </div>
  );
}
