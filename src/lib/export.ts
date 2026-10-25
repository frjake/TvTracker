import "server-only";

import { FOLLOW_STATUS } from "./constants";
import { type CsvValue, fileSafeName, toCsv, uniqueNames } from "./csv";
import { dateKey } from "./dates";
import { prisma } from "./db";

// Letterboxd-style account export: one CSV per kind of data, plus one per list.
// Returns { "path/in/zip.csv": contents }. Read-only.

type ShowLite = { id: number; name: string; firstAirDate: string | null };
type EpisodeLite = { seasonNumber: number; episodeNumber: number; name: string; show: ShowLite };
type SeasonLite = { seasonNumber: number; name: string; show: ShowLite };

const year = (s: ShowLite) => s.firstAirDate?.slice(0, 4) ?? "";
const iso = (d: Date) => d.toISOString();

/** Shared columns for anything that targets an episode or a whole season. */
const TARGET_HEADERS = ["Show", "Year", "Type", "Season", "Episode", "Title"];
function targetCells(episode: EpisodeLite | null, season: SeasonLite | null): CsvValue[] {
  if (episode) return [episode.show.name, year(episode.show), "Episode", episode.seasonNumber, episode.episodeNumber, episode.name];
  if (season) return [season.show.name, year(season.show), "Season", season.seasonNumber, "", season.name];
  return ["", "", "", "", "", ""];
}

const showSelect = { select: { id: true, name: true, firstAirDate: true } } as const;
const episodeInclude = { include: { show: showSelect } } as const;
const seasonInclude = { include: { show: showSelect } } as const;

export async function buildAccountExport(userId: string): Promise<Record<string, string>> {
  const [user, logs, marks, ratings, reviews, lists, followers, following] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.logEntry.findMany({
      where: { userId },
      include: { episode: episodeInclude },
      orderBy: [{ watchedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.watchedMark.findMany({ where: { userId }, include: { episode: episodeInclude } }),
    prisma.rating.findMany({
      where: { userId },
      include: { episode: episodeInclude, season: seasonInclude },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.review.findMany({
      where: { userId },
      include: { episode: episodeInclude, season: seasonInclude },
      orderBy: { createdAt: "asc" },
    }),
    prisma.list.findMany({
      where: { userId },
      include: { items: { orderBy: { position: "asc" }, include: { episode: episodeInclude, season: seasonInclude } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.follow.findMany({
      where: { followingId: userId, status: FOLLOW_STATUS.ACCEPTED },
      include: { follower: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.follow.findMany({
      where: { followerId: userId, status: FOLLOW_STATUS.ACCEPTED },
      include: { following: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const files: Record<string, string> = {};

  files["profile.csv"] = toCsv(
    ["Date Joined", "Username", "Display Name", "Email", "Bio", "Private Account"],
    [[dateKey(user.createdAt), user.username, user.displayName, user.email, user.bio, user.isPrivate]],
  );

  files["diary.csv"] = toCsv(
    ["Watched Date", "Show", "Year", "Season", "Episode", "Episode Title", "Rating", "Rewatch", "Review", "TMDB Show ID", "Logged Date"],
    logs.map((l) => [
      dateKey(l.watchedAt),
      l.episode.show.name,
      year(l.episode.show),
      l.episode.seasonNumber,
      l.episode.episodeNumber,
      l.episode.name,
      l.rating,
      l.rewatch,
      l.reviewText,
      l.episode.show.id,
      dateKey(l.createdAt),
    ]),
  );

  // Every episode counted as watched (marked OR logged), with the earliest date we know of.
  const watched = new Map<number, { date: Date; episode: EpisodeLite & { show: ShowLite } }>();
  const consider = (episodeId: number, date: Date, episode: EpisodeLite) => {
    const cur = watched.get(episodeId);
    if (!cur || date < cur.date) watched.set(episodeId, { date, episode });
  };
  for (const m of marks) consider(m.episodeId, m.createdAt, m.episode);
  for (const l of logs) consider(l.episodeId, l.watchedAt, l.episode);
  files["watched.csv"] = toCsv(
    ["Date", "Show", "Year", "Season", "Episode", "Episode Title", "TMDB Show ID"],
    [...watched.values()]
      .sort((a, b) => a.episode.show.name.localeCompare(b.episode.show.name) || a.episode.seasonNumber - b.episode.seasonNumber || a.episode.episodeNumber - b.episode.episodeNumber)
      .map(({ date, episode: e }) => [dateKey(date), e.show.name, year(e.show), e.seasonNumber, e.episodeNumber, e.name, e.show.id]),
  );

  const showIdOf = (x: { episode: EpisodeLite | null; season: SeasonLite | null }) => x.episode?.show.id ?? x.season?.show.id ?? "";
  files["ratings.csv"] = toCsv(
    ["Date", ...TARGET_HEADERS, "Rating", "TMDB Show ID"],
    ratings.map((r) => [dateKey(r.updatedAt), ...targetCells(r.episode, r.season), r.value, showIdOf(r)]),
  );

  // Pair each review with the author's standing rating of the same item, like Letterboxd.
  const ratingFor = (episodeId: number | null, seasonId: number | null) =>
    ratings.find((r) => (episodeId != null ? r.episodeId === episodeId : r.seasonId === seasonId))?.value ?? null;
  files["reviews.csv"] = toCsv(
    ["Date", ...TARGET_HEADERS, "Rating", "Review", "Contains Spoilers", "Last Edited", "TMDB Show ID"],
    reviews.map((r) => [
      dateKey(r.createdAt),
      ...targetCells(r.episode, r.season),
      ratingFor(r.episodeId, r.seasonId),
      r.body,
      r.containsSpoilers,
      iso(r.updatedAt),
      showIdOf(r),
    ]),
  );

  const listFiles = uniqueNames(lists.map((l) => fileSafeName(l.name))).map((stem) => `lists/${stem}.csv`);
  files["lists.csv"] = toCsv(
    ["Name", "Description", "Items", "Created", "Updated", "File"],
    lists.map((l, i) => [l.name, l.description, l.items.length, dateKey(l.createdAt), dateKey(l.updatedAt), listFiles[i]]),
  );
  lists.forEach((l, i) => {
    files[listFiles[i]] = toCsv(
      ["Position", ...TARGET_HEADERS, "Note", "TMDB Show ID"],
      l.items.map((item, idx) => [
        idx + 1,
        ...targetCells(item.episode, item.season),
        item.note,
        item.episode?.show.id ?? item.season?.show.id ?? "",
      ]),
    );
  });

  files["followers.csv"] = toCsv(
    ["Username", "Display Name", "Since"],
    followers.map((f) => [f.follower.username, f.follower.displayName, dateKey(f.createdAt)]),
  );
  files["following.csv"] = toCsv(
    ["Username", "Display Name", "Since"],
    following.map((f) => [f.following.username, f.following.displayName, dateKey(f.createdAt)]),
  );

  return files;
}
