import Link from "next/link";
import { type Dir } from "@/lib/people";

/**
 * Table header that sorts the table when clicked. `dir` is the active direction when this
 * column is the current sort (shows ▲/▼), null otherwise. Cycle is handled by the href.
 */
export function SortableTh({
  href,
  dir,
  children,
  align = "left",
}: {
  href: string;
  dir: Dir | null;
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <th className={`px-3 py-2 ${align === "center" ? "text-center" : ""}`} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <Link
        href={href}
        scroll={false}
        className={`inline-flex items-center gap-1 hover:text-foreground ${dir ? "text-foreground" : ""}`}
        title={dir === "asc" ? "Sorted ascending — click for descending" : dir === "desc" ? "Sorted descending — click for ascending" : "Click to sort ascending"}
      >
        {children}
        <span aria-hidden className={`text-[10px] ${dir ? "text-accent" : "text-muted opacity-40"}`}>
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "▲▼"}
        </span>
      </Link>
    </th>
  );
}
