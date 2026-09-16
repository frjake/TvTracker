"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { ACTIVITY_TYPE, RATING_MAX, RATING_MIN } from "@/lib/constants";
import { combineDateWithNow, isDateString } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { resolveTarget } from "@/lib/targets";

export type ActionState = { error?: string; ok?: boolean } | undefined;

// ---------- shared parsing ----------

const ratingField = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(RATING_MIN).max(RATING_MAX).optional(),
);

/** Every mutation touches several pages (item, diary, profile, feed); refresh them all. */
function refresh() {
  revalidatePath("/", "layout");
}

// ---------- watched marks ----------

export async function toggleWatched(formData: FormData) {
  const user = await requireUser();
  const { episodeId } = await resolveTarget(formData);
  if (episodeId == null) throw new Error("Episode required");

  const existing = await prisma.watchedMark.findUnique({
    where: { userId_episodeId: { userId: user.id, episodeId } },
  });
  if (existing) {
    await prisma.watchedMark.delete({ where: { id: existing.id } });
  } else {
    await prisma.watchedMark.create({ data: { userId: user.id, episodeId } });
  }
  refresh();
}

/** Marks every episode of the season watched (idempotent). */
export async function markSeasonWatched(formData: FormData) {
  const user = await requireUser();
  const { season } = await resolveTarget(formData);

  await prisma.$transaction(
    season.episodes.map((ep) =>
      prisma.watchedMark.upsert({
        where: { userId_episodeId: { userId: user.id, episodeId: ep.id } },
        create: { userId: user.id, episodeId: ep.id },
        update: {},
      }),
    ),
  );
  refresh();
}

export async function unmarkSeasonWatched(formData: FormData) {
  const user = await requireUser();
  const { season } = await resolveTarget(formData);
  await prisma.watchedMark.deleteMany({ where: { userId: user.id, episode: { seasonId: season.id } } });
  refresh();
}

// ---------- diary ----------

const logSchema = z.object({
  watchedOn: z.string().refine(isDateString, "Pick a valid date"),
  rating: ratingField,
  reviewText: z.string().trim().max(10_000).optional(),
  containsSpoilers: z.boolean(),
});

function parseLogFields(formData: FormData) {
  return logSchema.safeParse({
    watchedOn: formData.get("watchedOn"),
    rating: formData.get("rating"),
    reviewText: formData.get("reviewText") ?? undefined,
    containsSpoilers: formData.get("containsSpoilers") === "on",
  });
}

/** Logs one episode watch; an attached rating/review also becomes the standing one. */
export async function logEpisode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseLogFields(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { watchedOn, rating, reviewText, containsSpoilers } = parsed.data;

  const { episodeId } = await resolveTarget(formData);
  if (episodeId == null) return { error: "Episode required" };

  const entry = await prisma.logEntry.create({
    data: {
      userId: user.id,
      episodeId,
      watchedAt: combineDateWithNow(watchedOn),
      rating: rating ?? null,
      reviewText: reviewText || null,
    },
  });

  if (rating != null) {
    await prisma.rating.upsert({
      where: { userId_episodeId: { userId: user.id, episodeId } },
      create: { userId: user.id, episodeId, value: rating },
      update: { value: rating },
    });
  }
  if (reviewText) {
    await prisma.review.upsert({
      where: { userId_episodeId: { userId: user.id, episodeId } },
      create: { userId: user.id, episodeId, body: reviewText, containsSpoilers },
      update: { body: reviewText, containsSpoilers },
    });
  }

  await recordActivity({ userId: user.id, type: ACTIVITY_TYPE.LOG, episodeId, logEntryId: entry.id });
  refresh();
  return { ok: true };
}

/** Logs every episode of a season on one day, 1 s apart so episode order is preserved. */
export async function logSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseLogFields(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { watchedOn, rating, reviewText, containsSpoilers } = parsed.data;

  const { season } = await resolveTarget(formData);
  if (season.episodes.length === 0) return { error: "This season has no episodes yet" };

  const now = new Date();
  await prisma.logEntry.createMany({
    data: season.episodes.map((ep, i) => ({
      userId: user.id,
      episodeId: ep.id,
      watchedAt: combineDateWithNow(watchedOn, i, now),
    })),
  });

  if (rating != null) {
    await prisma.rating.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: { userId: user.id, seasonId: season.id, value: rating },
      update: { value: rating },
    });
  }
  if (reviewText) {
    await prisma.review.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: { userId: user.id, seasonId: season.id, body: reviewText, containsSpoilers },
      update: { body: reviewText, containsSpoilers },
    });
  }

  // One feed row for the whole season rather than one per episode.
  await recordActivity({ userId: user.id, type: ACTIVITY_TYPE.LOG, seasonId: season.id });
  refresh();
  return { ok: true };
}

export async function deleteLogEntry(formData: FormData) {
  const user = await requireUser();
  const id = z.string().parse(formData.get("id"));
  await prisma.logEntry.deleteMany({ where: { id, userId: user.id } });
  refresh();
}

// ---------- standing rating ----------

/** Sets (or, with an empty value, clears) the user's rating for an episode or season. */
export async function rateItem(formData: FormData) {
  const user = await requireUser();
  const value = ratingField.parse(formData.get("value"));
  const { episodeId, seasonId } = await resolveTarget(formData);

  const where =
    episodeId != null
      ? { userId_episodeId: { userId: user.id, episodeId } }
      : { userId_seasonId: { userId: user.id, seasonId: seasonId! } };

  if (value == null) {
    await prisma.rating.deleteMany({ where: { userId: user.id, episodeId, seasonId } });
  } else {
    const rating = await prisma.rating.upsert({
      where,
      create: { userId: user.id, episodeId, seasonId, value },
      update: { value },
    });
    await recordActivity({ userId: user.id, type: ACTIVITY_TYPE.RATING, episodeId, seasonId, ratingId: rating.id });
  }
  refresh();
}

// ---------- standing review ----------

const reviewSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(10_000, "Keep reviews under 10,000 characters"),
  containsSpoilers: z.boolean(),
});

export async function saveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse({
    body: formData.get("body"),
    containsSpoilers: formData.get("containsSpoilers") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { episodeId, seasonId } = await resolveTarget(formData);
  const where =
    episodeId != null
      ? { userId_episodeId: { userId: user.id, episodeId } }
      : { userId_seasonId: { userId: user.id, seasonId: seasonId! } };

  const review = await prisma.review.upsert({
    where,
    create: { userId: user.id, episodeId, seasonId, ...parsed.data },
    update: parsed.data,
  });
  await recordActivity({ userId: user.id, type: ACTIVITY_TYPE.REVIEW, episodeId, seasonId, reviewId: review.id });
  refresh();
  return { ok: true };
}

export async function deleteReview(formData: FormData) {
  const user = await requireUser();
  const id = z.string().parse(formData.get("id"));
  await prisma.review.deleteMany({ where: { id, userId: user.id } });
  refresh();
}
