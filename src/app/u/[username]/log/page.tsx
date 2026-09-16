import { DiaryList } from "@/components/DiaryList";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";

export default async function ProfileLogPage(props: PageProps<"/u/[username]/log">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null;

  const entries = await prisma.logEntry.findMany({
    where: { userId: ctx.owner.id },
    include: { episode: { include: { show: true } } },
    orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return <DiaryList entries={entries} canEdit={ctx.isSelf} />;
}
