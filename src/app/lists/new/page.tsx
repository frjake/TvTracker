import { requireUser } from "@/lib/auth";
import { ensureEpisode, ensureSeason, ensureShow } from "@/lib/cache";
import { type NewListTarget, NewListForm } from "./NewListForm";

export const metadata = { title: "New list" };

/** Reads ?showId=[&wholeShow=1[&includeSpecials=on]|&seasonNumber=[&episodeNumber=]]&returnTo= from an "Add to list → New list" click. */
async function readTarget(sp: Record<string, string | string[] | undefined>): Promise<NewListTarget | null> {
  const showId = Number(sp.showId);
  if (!Number.isInteger(showId) || showId <= 0) return null;
  const returnTo = typeof sp.returnTo === "string" && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//") ? sp.returnTo : "/";

  if (sp.wholeShow === "1") {
    const show = await ensureShow(showId);
    if (!show) return null;
    return { showId, includeSpecials: sp.includeSpecials === "on", label: show.name, returnTo };
  }

  const seasonNumber = Number(sp.seasonNumber);
  const episodeNumber = sp.episodeNumber != null ? Number(sp.episodeNumber) : undefined;
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) return null;

  if (episodeNumber != null && Number.isInteger(episodeNumber) && episodeNumber > 0) {
    const ep = await ensureEpisode(showId, seasonNumber, episodeNumber);
    if (!ep) return null;
    return { showId, seasonNumber, episodeNumber, label: `${ep.season.show.name} S${seasonNumber}E${episodeNumber} · ${ep.name}`, returnTo };
  }
  const season = await ensureSeason(showId, seasonNumber);
  if (!season) return null;
  return { showId, seasonNumber, label: `${season.show.name} – ${season.name}`, returnTo };
}

export default async function NewListPage(props: PageProps<"/lists/new">) {
  await requireUser("/lists/new");
  const target = await readTarget(await props.searchParams);
  return <NewListForm target={target} />;
}
