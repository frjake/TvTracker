import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CastTable, parseCastSort } from "@/components/CastTable";
import { ensureShow } from "@/lib/cache";
import { ensureShowCredits } from "@/lib/credits";

type Props = PageProps<"/show/[showId]/cast">;

async function load(props: Props) {
  const id = Number((await props.params).showId);
  return Number.isInteger(id) && id > 0 ? ensureShow(id) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const show = await load(props);
  return { title: show ? `${show.name} – Cast & crew` : "Cast" };
}

export default async function ShowCastPage(props: Props) {
  const show = await load(props);
  if (!show) notFound();
  const [credits, sp] = await Promise.all([ensureShowCredits(show.id), props.searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href={`/show/${show.id}`} className="hover:underline">{show.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Cast & crew</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">{show.name} — cast & crew</h1>
      <CastTable credits={credits} sort={parseCastSort(sp.sort)} base={`/show/${show.id}/cast`} />
    </div>
  );
}
