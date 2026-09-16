# TvTracker

A Letterboxd-style tracker for television. Log the episodes you watch by day, rate and review
episodes or whole seasons on a 0–100 % scale, keep lists, and follow other people to see what
they're watching. TV metadata comes from [TMDB](https://www.themoviedb.org/).

## Features

- **Watch log** – one entry per episode watch, grouped by day. Several entries on the same day
  stay in the order you logged them. "Log whole season" adds every episode at once.
- **Ratings & reviews** – rate any episode or season 0–100 %. Community scores are the average
  of TvTracker users' ratings; until someone rates, TMDB's score is shown (as a %, labelled
  "TMDB"). Reviews can be marked as containing spoilers.
- **Watched marks** – tick episodes (or a whole season) as already seen without adding them to
  the log.
- **Lists** – ordered lists of episodes and/or seasons, with notes-free reordering.
- **Follows & feed** – follow people to get their activity on your home page. Accounts can be
  made private: follow requests then need approval, and only accepted followers can see the
  profile, log, reviews and lists. Ratings from private accounts still count in averages.

## Stack

Next.js 16 (App Router, Server Actions, Turbopack) · TypeScript · Tailwind CSS 4 ·
Prisma 7 + SQLite (`better-sqlite3` driver adapter) · Vitest. Node ≥ 22.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

   (`postinstall` runs `prisma generate`. If npm reports blocked install scripts, run
   `npm approve-scripts better-sqlite3 prisma @prisma/engines` and `npm rebuild`.)

2. Create `.env` from the example and add your TMDB credentials:

   ```bash
   cp .env.example .env
   ```

   ```
   TMDB_API_KEY=your_v3_api_key        # or TMDB_ACCESS_TOKEN=your_v4_read_token
   DATABASE_URL="file:./dev.db"
   ```

3. Create the database:

   ```bash
   npx prisma migrate dev
   ```

4. Run it:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>, sign up, search for a show, and start logging.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / serve |
| `npm run check` | Lint + typecheck + unit tests |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a Prisma migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the SQLite database in Prisma Studio |

## How the data works

- **TMDB cache** – `Show`, `Season` and `Episode` rows are cached copies of TMDB data keyed by
  TMDB ids. They're created the first time anyone opens a page (or logs/rates something) and
  refreshed when older than 7 days. Search and trending always hit TMDB live.
- **Ratings** – integers 0–100. Each user has at most one *standing* rating per episode or
  season; a rating attached to a log entry updates the standing one. Averages use standing
  ratings only.
- **Log ordering** – `LogEntry.watchedAt` stores the chosen date plus the clock time at which
  you logged it. Only the date is displayed.

## Project layout

```
prisma/            schema + migrations
src/app/           routes (App Router) and server actions (src/app/actions)
src/components/    UI components
src/lib/           db client, TMDB client + cache, auth, policies, scores, feed helpers
tests/             Vitest unit tests for the pure helpers in src/lib
```

See `CLAUDE.md` for conventions and a deeper map.

---

This product uses the TMDB API but is not endorsed or certified by TMDB.
