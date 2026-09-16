import { ActivityItem } from "@/components/ActivityItem";
import { activityFor } from "@/lib/activity";
import { loadProfile } from "@/lib/profile";

export default async function ProfileActivityPage(props: PageProps<"/u/[username]">) {
  const ctx = await loadProfile((await props.params).username);
  if (!ctx?.canView) return null; // layout renders the private notice / 404

  const items = await activityFor(ctx.owner.id);
  if (items.length === 0) return <p className="text-sm text-muted">No activity yet.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => (
        <ActivityItem key={a.id} activity={a} showUser={!ctx.isSelf} />
      ))}
    </ul>
  );
}
