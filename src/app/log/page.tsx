import { DiaryList } from "@/components/DiaryList";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Your log" };

export default async function LogPage() {
  const user = await requireUser("/log");
  const entries = await prisma.logEntry.findMany({
    where: { userId: user.id },
    include: { episode: { include: { show: true } } },
    orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your log</h1>
      <p className="text-sm text-muted">{entries.length} episode{entries.length === 1 ? "" : "s"} logged.</p>
      <DiaryList entries={entries} canEdit />
    </div>
  );
}
