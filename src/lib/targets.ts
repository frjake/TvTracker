import "server-only";

import { z } from "zod";
import { ensureEpisode, ensureSeason, ensureShow } from "./cache";

// Form fields that identify an episode (or, without episodeNumber, a season).
// Shared by every server action that attaches user data to TMDB items.

export const targetSchema = z.object({
  showId: z.coerce.number().int().positive(),
  seasonNumber: z.coerce.number().int().min(0),
  episodeNumber: z.coerce.number().int().positive().optional(),
});

export function targetFields(formData: FormData) {
  return {
    showId: formData.get("showId"),
    seasonNumber: formData.get("seasonNumber"),
    episodeNumber: formData.get("episodeNumber") ?? undefined,
  };
}

/** Parses the target fields and makes sure the cached rows exist, returning ids for FKs. */
export async function resolveTarget(formData: FormData) {
  const t = targetSchema.parse(targetFields(formData));
  if (t.episodeNumber != null) {
    const episode = await ensureEpisode(t.showId, t.seasonNumber, t.episodeNumber);
    if (!episode) throw new Error("Episode not found");
    return { episodeId: episode.id, seasonId: null as number | null, episode, season: episode.season };
  }
  const season = await ensureSeason(t.showId, t.seasonNumber);
  if (!season) throw new Error("Season not found");
  return { episodeId: null as number | null, seasonId: season.id, episode: null, season };
}

/**
 * A show's seasons for whole-show operations, in season order. Specials (season 0) are
 * dropped unless `includeSpecials`. Only seasons TMDB reports episodes for are returned.
 */
export async function resolveShowSeasons(showId: number, includeSpecials: boolean) {
  const show = await ensureShow(showId);
  if (!show) throw new Error("Show not found");
  const seasons = show.seasons.filter((s) => (includeSpecials || s.seasonNumber !== 0) && (s.episodeCount ?? 0) > 0);
  return { show, seasons };
}
