import Image from "next/image";
import Link from "next/link";
import type { FeedItem } from "@/lib/activity";
import { ACTIVITY_TYPE } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/dates";
import { imageUrl } from "@/lib/tmdb";

function itemLink(a: FeedItem) {
  if (a.episode) {
    return {
      href: `/show/${a.episode.show.id}/season/${a.episode.seasonNumber}/episode/${a.episode.episodeNumber}`,
      label: `${a.episode.show.name} S${a.episode.seasonNumber}E${a.episode.episodeNumber} · ${a.episode.name}`,
      poster: a.episode.show.posterPath,
    };
  }
  if (a.season) {
    return {
      href: `/show/${a.season.show.id}/season/${a.season.seasonNumber}`,
      label: `${a.season.show.name} – ${a.season.name}`,
      poster: a.season.posterPath ?? a.season.show.posterPath,
    };
  }
  return null;
}

function Body({ text, spoilers }: { text: string; spoilers: boolean }) {
  if (spoilers) {
    return (
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-muted">Contains spoilers — reveal</summary>
        <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
      </details>
    );
  }
  return <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm">{text}</p>;
}

/** One row of the activity feed / profile timeline. */
export function ActivityItem({ activity: a, showUser = true }: { activity: FeedItem; showUser?: boolean }) {
  const item = itemLink(a);
  const who = showUser ? (
    <Link href={`/u/${a.user.username}`} className="font-medium hover:underline">
      {a.user.displayName ?? a.user.username}
    </Link>
  ) : (
    <span className="font-medium">You</span>
  );

  let verb: React.ReactNode;
  let detail: React.ReactNode = null;

  switch (a.type) {
    case ACTIVITY_TYPE.LOG:
      if (a.logEntry) {
        verb = <>watched</>;
        detail = (
          <>
            <span className="text-xs text-muted">on {formatDate(a.logEntry.watchedAt)}</span>
            {a.logEntry.rating != null && <span className="ml-2 text-sm font-semibold text-accent">{a.logEntry.rating}%</span>}
            {a.logEntry.reviewText && <Body text={a.logEntry.reviewText} spoilers={a.review?.containsSpoilers ?? false} />}
          </>
        );
      } else {
        verb = <>logged all of</>;
      }
      break;
    case ACTIVITY_TYPE.RATING:
      verb = <>rated {a.rating && <span className="font-semibold text-accent">{a.rating.value}%</span>}</>;
      break;
    case ACTIVITY_TYPE.REVIEW:
      verb = <>reviewed</>;
      detail = a.review ? <Body text={a.review.body} spoilers={a.review.containsSpoilers} /> : null;
      break;
    case ACTIVITY_TYPE.LIST_CREATED:
      verb = <>created a list</>;
      break;
    default:
      verb = <>did something with</>;
  }

  const poster = imageUrl(item?.poster, "w92");

  return (
    <li className="card flex gap-3">
      <div className="w-10 shrink-0">
        {poster ? (
          <Image src={poster} alt="" width={92} height={138} className="rounded" />
        ) : (
          <div className="aspect-[2/3] rounded bg-background" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          {who} {verb}{" "}
          {item && (
            <Link href={item.href} className="font-medium hover:underline">{item.label}</Link>
          )}
          {a.type === ACTIVITY_TYPE.LIST_CREATED && a.list && (
            <Link href={`/lists/${a.list.id}`} className="font-medium hover:underline">
              {a.list.name} <span className="text-muted">({a.list._count.items} items)</span>
            </Link>
          )}
        </p>
        {detail}
        <p className="mt-1 text-xs text-muted">{timeAgo(a.createdAt)}</p>
      </div>
    </li>
  );
}
