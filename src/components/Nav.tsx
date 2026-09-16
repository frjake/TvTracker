import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export async function Nav() {
  const user = await getCurrentUser();
  const pendingCount = user
    ? await prisma.follow.count({ where: { followingId: user.id, status: FOLLOW_STATUS.PENDING } })
    : 0;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-accent">
          TvTracker
        </Link>

        <form action="/search" className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-md">
          <input
            type="search"
            name="q"
            placeholder="Search TV shows…"
            aria-label="Search TV shows"
            className="input"
          />
        </form>

        <nav className="ml-auto flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/log" className="navlink">Log</Link>
              <Link href={`/u/${user.username}/lists`} className="navlink">Lists</Link>
              <Link href="/requests" className="navlink relative">
                Requests
                {pendingCount > 0 && (
                  <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-medium text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href={`/u/${user.username}`} className="navlink font-medium">
                @{user.username}
              </Link>
              <Link href="/settings" className="navlink">Settings</Link>
              <form action={logout}>
                <button type="submit" className="navlink">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="navlink">Log in</Link>
              <Link href="/register" className="btn-primary">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
