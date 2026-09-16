import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";

interface Props {
  id: number;
  name: string;
  posterPath: string | null;
  firstAirDate?: string | null;
}

export function ShowCard({ id, name, posterPath, firstAirDate }: Props) {
  const poster = imageUrl(posterPath, "w342");
  const year = firstAirDate?.slice(0, 4);
  return (
    <Link href={`/show/${id}`} className="group block">
      <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-surface">
        {poster ? (
          <Image
            src={poster}
            alt={`${name} poster`}
            width={342}
            height={513}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">{name}</div>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium group-hover:underline">{name}</p>
      {year && <p className="text-xs text-muted">{year}</p>}
    </Link>
  );
}

export function ShowGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">{children}</div>;
}
