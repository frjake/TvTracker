import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";

/** Clickable person card: photo (or initial), name, role line, optional meta. */
export function PersonChip({
  id,
  name,
  profilePath,
  role,
  meta,
  size = "md",
}: {
  id: number;
  name: string;
  profilePath: string | null;
  role?: string | null;
  meta?: string | null;
  size?: "sm" | "md";
}) {
  const photo = imageUrl(profilePath, "w185");
  const dim = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  return (
    <Link href={`/person/${id}`} className="group flex items-center gap-3 rounded-md p-1 hover:bg-background">
      <div className={`${dim} shrink-0 overflow-hidden rounded-full bg-accent-soft`}>
        {photo ? (
          <Image src={photo} alt="" width={185} height={278} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-accent">{name[0]}</div>
        )}
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium group-hover:underline">{name}</p>
        {role && <p className="truncate text-xs text-muted">{role}</p>}
        {meta && <p className="truncate text-xs text-muted">{meta}</p>}
      </div>
    </Link>
  );
}
