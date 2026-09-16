"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ensureShow } from "@/lib/cache";
import { SCAN_MAX_EPISODES } from "@/lib/constants";
import { scanSeasonEpisodeCredits, scanShowEpisodeCredits } from "@/lib/credits";

const idField = z.coerce.number().int().positive();

/**
 * Fetches credits for every episode of a show so people pages can list episode appearances.
 * Shows over SCAN_MAX_EPISODES are only cached here (the page then offers per-season scans).
 */
export async function scanShow(formData: FormData) {
  await requireUser();
  const showId = idField.parse(formData.get("showId"));
  const show = await ensureShow(showId);
  if (show && (show.numberOfEpisodes ?? 0) <= SCAN_MAX_EPISODES) {
    await scanShowEpisodeCredits(showId);
  }
  revalidatePath("/", "layout");
}

export async function scanSeason(formData: FormData) {
  await requireUser();
  const showId = idField.parse(formData.get("showId"));
  const seasonNumber = z.coerce.number().int().min(0).parse(formData.get("seasonNumber"));
  await scanSeasonEpisodeCredits(showId, seasonNumber);
  revalidatePath("/", "layout");
}
