"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { FOLLOW_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type SettingsState = { error?: string; ok?: boolean } | undefined;

const profileSchema = z.object({
  displayName: z.string().trim().max(50, "Display name must be 50 characters or fewer"),
  bio: z.string().trim().max(300, "Bio must be 300 characters or fewer"),
  isPrivate: z.boolean(),
});

export async function updateProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const me = await requireUser("/settings");
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    bio: formData.get("bio") ?? "",
    isPrivate: formData.get("isPrivate") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { displayName, bio, isPrivate } = parsed.data;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: me.id },
      data: { displayName: displayName || null, bio: bio || null, isPrivate },
    }),
    // Going public: anyone still waiting gets in.
    ...(!isPrivate && me.isPrivate
      ? [
          prisma.follow.updateMany({
            where: { followingId: me.id, status: FOLLOW_STATUS.PENDING },
            data: { status: FOLLOW_STATUS.ACCEPTED },
          }),
        ]
      : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "New password must be at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "New passwords don't match", path: ["confirm"] });

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const me = await requireUser("/settings");
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { error: "Current password is incorrect" };
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  return { ok: true };
}
