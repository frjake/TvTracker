import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/profile";

export default async function ProfileListsPage(props: PageProps<"/u/[username]/lists">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null;

  const lists = await prisma.list.findMany({
    where: { userId: ctx.owner.id },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      {ctx.isSelf && (
        <Link href="/lists/new" className="btn-primary self-start">+ New list</Link>
      )}
      {lists.length === 0 ? (
        <p className="text-sm text-muted">No lists yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/lists/${l.id}`} className="card block hover:border-accent">
                <p className="font-medium">{l.name}</p>
                {l.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{l.description}</p>}
                <p className="mt-2 text-xs text-muted">{l._count.items} item{l._count.items === 1 ? "" : "s"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
