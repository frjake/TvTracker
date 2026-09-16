import type { Metadata } from "next";
import { ShowCard, ShowGrid } from "@/components/ShowCard";
import { searchTv } from "@/lib/tmdb";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: typeof q === "string" && q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  if (!query) {
    return <p className="text-muted">Type a show name in the search box above.</p>;
  }

  let results;
  try {
    results = (await searchTv(query)).results;
  } catch (err) {
    return (
      <p className="card text-sm text-muted">
        Search failed: {err instanceof Error ? err.message : "unknown error"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        Results for <span className="text-accent">“{query}”</span>
      </h1>
      {results.length === 0 ? (
        <p className="text-muted">No shows found.</p>
      ) : (
        <ShowGrid>
          {results.map((s) => (
            <ShowCard key={s.id} id={s.id} name={s.name} posterPath={s.poster_path} firstAirDate={s.first_air_date} />
          ))}
        </ShowGrid>
      )}
    </div>
  );
}
