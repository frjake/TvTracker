import Link from "next/link";
import { formatDate } from "@/lib/dates";

export interface ReviewListItem {
  id: string;
  body: string;
  containsSpoilers: boolean;
  updatedAt: Date;
  user: { username: string; displayName: string | null };
  rating: number | null;
}

export function ReviewList({ reviews, emptyText = "No reviews yet." }: { reviews: ReviewListItem[]; emptyText?: string }) {
  if (reviews.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((r) => (
        <li key={r.id} className="card">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <Link href={`/u/${r.user.username}`} className="font-medium hover:underline">
              {r.user.displayName ?? r.user.username}
            </Link>
            {r.rating != null && <span className="font-semibold text-accent tabular-nums">{r.rating}%</span>}
            <span className="text-xs text-muted">{formatDate(r.updatedAt)}</span>
          </div>
          {r.containsSpoilers ? (
            <details>
              <summary className="cursor-pointer text-sm text-muted">Contains spoilers — click to reveal</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
            </details>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
