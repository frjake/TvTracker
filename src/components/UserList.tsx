import Link from "next/link";

export interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  isPrivate: boolean;
}

export function UserList({
  users,
  emptyText,
  renderAction,
}: {
  users: UserRow[];
  emptyText: string;
  renderAction?: (user: UserRow) => React.ReactNode;
}) {
  if (users.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {u.username[0].toUpperCase()}
          </div>
          <Link href={`/u/${u.username}`} className="min-w-0 flex-1 text-sm hover:underline">
            <span className="font-medium">{u.displayName ?? u.username}</span>
            {u.displayName && <span className="ml-2 text-muted">{u.username}</span>}
            {u.isPrivate && <span className="ml-2 text-xs text-muted">· private</span>}
          </Link>
          {renderAction?.(u)}
        </li>
      ))}
    </ul>
  );
}
