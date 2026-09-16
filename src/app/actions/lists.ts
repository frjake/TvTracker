"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { ACTIVITY_TYPE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { resolveTarget } from "@/lib/targets";

export type ListFormState = { error?: string; ok?: boolean } | undefined;

const listSchema = z.object({
  name: z.string().trim().min(1, "Give the list a name").max(100, "Keep the name under 100 characters"),
  description: z.string().trim().max(2000).optional(),
});

function refresh() {
  revalidatePath("/", "layout");
}

async function ownedList(listId: string, userId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list || list.userId !== userId) throw new Error("List not found");
  return list;
}

export async function createList(_prev: ListFormState, formData: FormData): Promise<ListFormState> {
  const user = await requireUser("/lists/new");
  const parsed = listSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const list = await prisma.list.create({
    data: { userId: user.id, name: parsed.data.name, description: parsed.data.description || null },
  });
  await recordActivity({ userId: user.id, type: ACTIVITY_TYPE.LIST_CREATED, listId: list.id });
  refresh();
  redirect(`/lists/${list.id}`);
}

export async function updateList(_prev: ListFormState, formData: FormData): Promise<ListFormState> {
  const user = await requireUser();
  const id = z.string().parse(formData.get("id"));
  await ownedList(id, user.id);
  const parsed = listSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await prisma.list.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description || null },
  });
  refresh();
  return { ok: true };
}

export async function deleteList(formData: FormData) {
  const user = await requireUser();
  const id = z.string().parse(formData.get("id"));
  await ownedList(id, user.id);
  await prisma.list.delete({ where: { id } });
  refresh();
  redirect(`/u/${user.username}/lists`);
}

/** Adds an episode or season to one of the user's lists (no-op if already there). */
export async function addToList(formData: FormData) {
  const user = await requireUser();
  const listId = z.string().parse(formData.get("listId"));
  await ownedList(listId, user.id);
  const { episodeId, seasonId } = await resolveTarget(formData);

  const existing = await prisma.listItem.findFirst({ where: { listId, episodeId, seasonId } });
  if (!existing) {
    const last = await prisma.listItem.aggregate({ where: { listId }, _max: { position: true } });
    await prisma.listItem.create({
      data: { listId, episodeId, seasonId, position: (last._max.position ?? 0) + 1 },
    });
    await prisma.list.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  }
  refresh();
}

export async function removeFromList(formData: FormData) {
  const user = await requireUser();
  const itemId = z.string().parse(formData.get("itemId"));
  const item = await prisma.listItem.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item || item.list.userId !== user.id) throw new Error("Item not found");
  await prisma.listItem.delete({ where: { id: itemId } });
  refresh();
}

/** Swaps an item with its neighbour above or below. */
export async function moveListItem(formData: FormData) {
  const user = await requireUser();
  const itemId = z.string().parse(formData.get("itemId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));

  const item = await prisma.listItem.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item || item.list.userId !== user.id) throw new Error("Item not found");

  const neighbour = await prisma.listItem.findFirst({
    where: {
      listId: item.listId,
      position: direction === "up" ? { lt: item.position } : { gt: item.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;

  await prisma.$transaction([
    prisma.listItem.update({ where: { id: item.id }, data: { position: neighbour.position } }),
    prisma.listItem.update({ where: { id: neighbour.id }, data: { position: item.position } }),
  ]);
  refresh();
}
