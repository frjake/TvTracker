import { recommendationsFor } from "@/lib/recommendations";
import { ShowCard, ShowGrid } from "./ShowCard";

/** "Recommended for you" — renders nothing until the user has watched something. */
export async function Recommendations({ userId }: { userId: string }) {
  let set;
  try {
    set = await recommendationsFor(userId);
  } catch {
    return null; // TMDB hiccup: hide the section rather than break the home page
  }
  if (set.items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Recommended for you</h2>
      <ShowGrid>
        {set.items.map((r) => {
          const because = set.seedNames.get(r.becauseShowId);
          return (
            <ShowCard
              key={r.show.id}
              id={r.show.id}
              name={r.show.name}
              posterPath={r.show.poster_path}
              firstAirDate={r.show.first_air_date}
              caption={because ? `Because you watched ${because}` : null}
            />
          );
        })}
      </ShowGrid>
    </section>
  );
}

/** Same footprint as a populated section while recommendations load. */
export function RecommendationsSkeleton() {
  return (
    <section aria-hidden>
      <div className="mb-3 h-6 w-48 animate-pulse rounded bg-surface" />
      <ShowGrid>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-md border border-line bg-surface" />
        ))}
      </ShowGrid>
    </section>
  );
}
