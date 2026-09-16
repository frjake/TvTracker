import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CastTable, parseCastSort } from "@/components/CastTable";
import { ensureSeason } from "@/lib/cache";
import { ensureSeasonCredits } from "@/lib/credits";

type Props = PageProps<"/show/[showId]/season/[seasonNumber]/cast">;

async function load(props: Props) {
  const { showId, seasonNumber } = await props.params;
  const s = Number(showId);
  const n = Number(seasonNumber);
  if (!Number.isInteger(s) || s <= 0 || !Number.isInteger(n) || n < 0) return null;
  return ensureSeason(s, n);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const season = await load(props);
  return { title: season ? `${season.show.name} – ${season.name} – Cast & crew` : "Cast" };
}

export default async function SeasonCastPage(props: Props) {
  const season = await load(props);
  if (!season) notFound();
  const [credits, sp] = await Promise.all([ensureSeasonCredits(season.showId, season.seasonNumber), props.searchParams]);
  const base = `/show/${season.showId}/season/${season.seasonNumber}`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href={`/show/${season.showId}`} className="hover:underline">{season.show.name}</Link>
        <span className="mx-2">/</span>
        <Link href={base} className="hover:underline">{season.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Cast & crew</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">{season.show.name} — {season.name} cast & crew</h1>
      <CastTable credits={credits} sort={parseCastSort(sp.sort)} base={`${base}/cast`} />
    </div>
  );
}
