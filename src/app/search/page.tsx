import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShowCard, ShowGrid } from "@/components/ShowCard";
import { type TmdbPersonSummary, type TmdbShowSummary, imageUrl, searchPeople, searchTv } from "@/lib/tmdb";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: typeof q === "string" && q ? `Search: ${q}` : "Search" };
}

function PersonCard({ p }: { p: TmdbPersonSummary }) {
  const photo = imageUrl(p.profile_path, "w185");
  const knownFor = p.known_for
    .map((k) => k.name ?? k.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  return (
    <Link href={`/person/${p.id}`} className="card flex items-center gap-3 hover:border-accent">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-accent-soft">
        {photo ? (
          <Image src={photo} alt="" width={185} height={278} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-accent">{p.name[0]}</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{p.name}</p>
        {p.known_for_department && <p className="text-xs text-muted">{p.known_for_department}</p>}
        {knownFor && <p className="mt-0.5 truncate text-xs text-muted">Known for {knownFor}</p>}
      </div>
    </Link>
  );
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q, tab } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const active = tab === "people" ? "people" : "shows";

  if (!query) {
    return <p className="text-muted">Type a show or person&apos;s name in the search box above.</p>;
  }

  let shows: TmdbShowSummary[];
  let people: TmdbPersonSummary[];
  try {
    [shows, people] = await Promise.all([
      searchTv(query).then((r) => r.results),
      searchPeople(query).then((r) => r.results),
    ]);
  } catch (err) {
    return (
      <p className="card text-sm text-muted">
        Search failed: {err instanceof Error ? err.message : "unknown error"}
      </p>
    );
  }

  const encoded = encodeURIComponent(query);
  const tabs = [
    { key: "shows", label: `Shows (${shows.length})`, href: `/search?q=${encoded}` },
    { key: "people", label: `People (${people.length})`, href: `/search?q=${encoded}&tab=people` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        Results for <span className="text-accent">“{query}”</span>
      </h1>
      <nav className="flex gap-1 border-b border-line text-sm" aria-label="Result type">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${t.key === active ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === "shows" ? (
        shows.length === 0 ? (
          <p className="text-muted">No shows found{people.length > 0 ? " — try the People tab." : "."}</p>
        ) : (
          <ShowGrid>
            {shows.map((s) => (
              <ShowCard key={s.id} id={s.id} name={s.name} posterPath={s.poster_path} firstAirDate={s.first_air_date} />
            ))}
          </ShowGrid>
        )
      ) : people.length === 0 ? (
        <p className="text-muted">No people found{shows.length > 0 ? " — try the Shows tab." : "."}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <li key={p.id}><PersonCard p={p} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
