import { formatDate } from "@/lib/dates";
import { recentlyLoggedShows } from "@/lib/recent";
import { ShowCard, ShowGrid } from "./ShowCard";

/** "Recently watched" — the user's 12 most recently logged shows. Hidden until something is logged. */
export async function RecentlyWatched({ userId }: { userId: string }) {
  const entries = await recentlyLoggedShows(userId, 12);
  if (entries.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Recently watched</h2>
      <ShowGrid>
        {entries.map((e) => {
          const { show } = e.episode;
          return (
            <ShowCard
              key={show.id}
              id={show.id}
              name={show.name}
              posterPath={show.posterPath}
              caption={`S${e.episode.seasonNumber}E${e.episode.episodeNumber} · ${formatDate(e.watchedAt)}`}
              href={`/show/${show.id}/season/${e.episode.seasonNumber}/episode/${e.episode.episodeNumber}`}
            />
          );
        })}
      </ShowGrid>
    </section>
  );
}
