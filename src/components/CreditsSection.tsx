import Link from "next/link";
import { CREDIT_KIND } from "@/lib/constants";
import type { CreditWithPerson } from "@/lib/credits";
import { PersonChip } from "./PersonChip";

interface Grouped {
  person: CreditWithPerson["person"];
  roles: string[];
  order: number | null;
  episodeCount: number | null;
}

/** Merges a person's several credit rows (multiple characters/jobs) into one chip. */
export function groupByPerson(credits: CreditWithPerson[]): Grouped[] {
  const map = new Map<number, Grouped>();
  for (const c of credits) {
    const role = c.character ?? c.job ?? "";
    const g = map.get(c.personId);
    if (g) {
      if (role && !g.roles.includes(role)) g.roles.push(role);
      if (g.order == null || (c.order != null && c.order < g.order)) g.order = c.order;
      if (c.episodeCount != null) g.episodeCount = Math.max(g.episodeCount ?? 0, c.episodeCount);
    } else {
      map.set(c.personId, { person: c.person, roles: role ? [role] : [], order: c.order, episodeCount: c.episodeCount });
    }
  }
  return [...map.values()].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.person.name.localeCompare(b.person.name));
}

function eps(n: number | null) {
  return n != null ? `${n} episode${n === 1 ? "" : "s"}` : null;
}

export function CastGrid({ people, limit }: { people: Grouped[]; limit?: number }) {
  const shown = limit ? people.slice(0, limit) : people;
  if (shown.length === 0) return <p className="text-sm text-muted">No cast listed.</p>;
  return (
    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((g) => (
        <li key={g.person.id}>
          <PersonChip id={g.person.id} name={g.person.name} profilePath={g.person.profilePath} role={g.roles.join(" / ")} meta={eps(g.episodeCount)} />
        </li>
      ))}
    </ul>
  );
}

/** Key crew grouped by job: "Director — A, B". */
export function CrewList({ credits }: { credits: CreditWithPerson[] }) {
  if (credits.length === 0) return <p className="text-sm text-muted">No key crew listed.</p>;
  const byJob = new Map<string, CreditWithPerson[]>();
  for (const c of credits) {
    const job = c.job ?? "Crew";
    byJob.set(job, [...(byJob.get(job) ?? []), c]);
  }
  const jobOrder = ["Creator", "Executive Producer", "Director", "Writer"];
  const jobs = [...byJob.keys()].sort((a, b) => {
    const ia = jobOrder.indexOf(a);
    const ib = jobOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      {jobs.map((job) => {
        const seen = new Set<number>();
        const people = byJob.get(job)!.filter((c) => (seen.has(c.personId) ? false : (seen.add(c.personId), true)));
        return (
          <div key={job} className="contents">
            <dt className="text-muted">{job}</dt>
            <dd className="flex flex-wrap gap-x-3 gap-y-1">
              {people.map((c, i) => (
                <span key={c.personId}>
                  <Link href={`/person/${c.personId}`} className="font-medium hover:underline">{c.person.name}</Link>
                  {c.episodeCount != null && <span className="text-xs text-muted"> ({c.episodeCount})</span>}
                  {i < people.length - 1 && <span className="text-muted">,</span>}
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Cast + key crew for a show/season/episode. `seeAllHref` links to the full sortable list;
 * episodes pass `withGuests` to render guest stars separately.
 */
export function CreditsSection({
  credits,
  castLimit = 12,
  seeAllHref,
  withGuests = false,
}: {
  credits: CreditWithPerson[];
  castLimit?: number;
  seeAllHref?: string;
  withGuests?: boolean;
}) {
  const cast = groupByPerson(credits.filter((c) => c.kind === CREDIT_KIND.CAST));
  const guests = withGuests ? groupByPerson(credits.filter((c) => c.kind === CREDIT_KIND.GUEST)) : [];
  const crew = credits.filter((c) => c.kind === CREDIT_KIND.CREW);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Cast</h2>
          {seeAllHref && cast.length > castLimit && (
            <Link href={seeAllHref} className="text-sm text-accent hover:underline">See all {cast.length} →</Link>
          )}
        </div>
        <CastGrid people={cast} limit={castLimit} />
      </div>
      {withGuests && guests.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Guest stars</h2>
          <CastGrid people={guests} />
        </div>
      )}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Crew</h2>
        <CrewList credits={crew} />
      </div>
    </section>
  );
}
