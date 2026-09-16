import Link from "next/link";
import { CREDIT_KIND } from "@/lib/constants";
import type { CreditWithPerson } from "@/lib/credits";
import { CrewList, groupByPerson } from "./CreditsSection";
import { PersonChip } from "./PersonChip";

export const CAST_SORTS = ["billing", "episodes", "name"] as const;
export type CastSort = (typeof CAST_SORTS)[number];

export function parseCastSort(value: string | string[] | undefined): CastSort {
  return CAST_SORTS.includes(value as CastSort) ? (value as CastSort) : "billing";
}

/** Full cast list for a show or season, sortable via ?sort=billing|episodes|name. */
export function CastTable({ credits, sort, base }: { credits: CreditWithPerson[]; sort: CastSort; base: string }) {
  const cast = groupByPerson(credits.filter((c) => c.kind === CREDIT_KIND.CAST));
  const crew = credits.filter((c) => c.kind === CREDIT_KIND.CREW);

  const sorted = [...cast].sort((a, b) => {
    if (sort === "episodes") return (b.episodeCount ?? -1) - (a.episodeCount ?? -1) || a.person.name.localeCompare(b.person.name);
    if (sort === "name") return a.person.name.localeCompare(b.person.name);
    return (a.order ?? 1e9) - (b.order ?? 1e9);
  });

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Cast ({sorted.length})</h2>
          <nav className="flex gap-1 text-sm">
            {CAST_SORTS.map((s) => (
              <Link
                key={s}
                href={s === "billing" ? base : `${base}?sort=${s}`}
                className={`rounded px-2 py-1 ${s === sort ? "bg-accent text-white" : "navlink"}`}
              >
                {s === "billing" ? "Billing order" : s === "episodes" ? "Episodes" : "Name"}
              </Link>
            ))}
          </nav>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No cast listed.</p>
        ) : (
          <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
            {sorted.map((g, i) => (
              <li key={g.person.id} className="flex items-center gap-2 px-2 py-1">
                <span className="w-8 text-right text-xs tabular-nums text-muted">{sort === "billing" && g.order != null ? g.order + 1 : i + 1}</span>
                <div className="flex-1">
                  <PersonChip
                    id={g.person.id}
                    name={g.person.name}
                    profilePath={g.person.profilePath}
                    role={g.roles.join(" / ")}
                    meta={g.episodeCount != null ? `${g.episodeCount} episode${g.episodeCount === 1 ? "" : "s"}` : null}
                    size="sm"
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Crew</h2>
        <CrewList credits={crew} />
      </section>
    </div>
  );
}
