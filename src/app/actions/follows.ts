"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";

const idField = z.string().min(1);

function refresh() {
  revalidatePath("/", "layout");
}

/** Follows a public account immediately; sends a request to a private one. */
export async function followUser(formData: FormData) {
  const me = await requireUser();
  const targetId = idField.parse(formData.get("userId"));
  if (targetId === me.id) return;

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { isPrivate: true } });
  if (!target) throw new Error("User not found");

  const status = target.isPrivate ? FOLLOW_STATUS.PENDING : FOLLOW_STATUS.ACCEPTED;
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me.id, followingId: targetId } },
    create: { followerId: me.id, followingId: targetId, status },
    update: {}, // already following or pending: leave as is
  });
  refresh();
}

/** Unfollows, or cancels a pending request. */
export async function unfollowUser(formData: FormData) {
  const me = await requireUser();
  const targetId = idField.parse(formData.get("userId"));
  await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: targetId } });
  refresh();
}

export async function acceptFollowRequest(formData: FormData) {
  const me = await requireUser();
  const followerId = idField.parse(formData.get("userId"));
  await prisma.follow.updateMany({
    where: { followerId, followingId: me.id, status: FOLLOW_STATUS.PENDING },
    data: { status: FOLLOW_STATUS.ACCEPTED },
  });
  refresh();
}

/** Declines a pending request, or removes an existing follower. */
export async function removeFollower(formData: FormData) {
  const me = await requireUser();
  const followerId = idField.parse(formData.get("userId"));
  await prisma.follow.deleteMany({ where: { followerId, followingId: me.id } });
  refresh();
}
