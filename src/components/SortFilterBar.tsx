import {
  EPISODE_SORTS,
  EPISODE_SORT_LABELS,
  type FilmographyQuery,
  SHOW_SORTS,
  SHOW_SORT_LABELS,
  defaultDirFor,
} from "@/lib/people";

/**
 * GET form for sorting/filtering a person's shows or episodes. Renders the controls for one
 * section and carries the other section's non-default params as hidden inputs so both
 * tables keep their state in one URL.
 */
export function SortFilterBar({
  q,
  section,
  signedIn,
  showOptions = [],
}: {
  q: FilmographyQuery;
  section: "shows" | "episodes";
  signedIn: boolean;
  showOptions?: { id: number; name: string }[];
}) {
  const hidden: [string, string][] = [];
  const keep = (key: string, value: string | number | boolean | null, def: string | number | boolean | null) => {
    if (value !== def && value != null && value !== false) hidden.push([key, value === true ? "1" : String(value)]);
  };

  if (section === "episodes") {
    keep("sort", q.sort, "date");
    keep("dir", q.dir, defaultDirFor(q.sort));
    keep("watched", q.watched, "any");
    keep("from", q.from, null);
    keep("to", q.to, null);
    keep("all", q.all, false);
    keep("singles", q.singles, false);
    keep("dept", q.dept, "all");
  } else {
    keep("esort", q.esort, "date");
    keep("edir", q.edir, defaultDirFor(q.esort));
    keep("ewatched", q.ewatched, "any");
    keep("efrom", q.efrom, null);
    keep("eto", q.eto, null);
    keep("eshow", q.eshow, null);
  }

  const p = section === "episodes" ? "e" : "";
  const sorts = section === "episodes" ? EPISODE_SORTS : SHOW_SORTS;
  const labels: Record<string, string> = section === "episodes" ? EPISODE_SORT_LABELS : SHOW_SORT_LABELS;
  const sort = section === "episodes" ? q.esort : q.sort;
  const dir = section === "episodes" ? q.edir : q.dir;

  return (
    <form method="get" className="card flex flex-wrap items-end gap-3 text-sm" id={`${section}-filters`}>
      {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Sort by</span>
        <select name={`${p}sort`} defaultValue={sort} className="input w-44">
          {sorts.map((s) => (
            <option key={s} value={s} disabled={s === "myrating" && !signedIn}>
              {labels[s]}{s === "myrating" && !signedIn ? " (log in)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Order</span>
        <select name={`${p}dir`} defaultValue={dir} className="input w-32">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </label>

      {section === "shows" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Watched</span>
            <select name="watched" defaultValue={q.watched} className="input w-36" disabled={!signedIn}>
              <option value="any">Any</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Role</span>
            <select name="dept" defaultValue={q.dept} className="input w-28">
              <option value="all">All</option>
              <option value="cast">Cast</option>
              <option value="crew">Crew</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Watched</span>
            <select name="ewatched" defaultValue={q.ewatched} className="input w-32" disabled={!signedIn}>
              <option value="any">Any</option>
              <option value="watched">Watched</option>
              <option value="unwatched">Unwatched</option>
            </select>
          </label>
          {showOptions.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Show</span>
              <select name="eshow" defaultValue={q.eshow ?? ""} className="input w-44">
                <option value="">All shows</option>
                {showOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">From year</span>
        <input type="number" name={`${p}from`} defaultValue={(section === "episodes" ? q.efrom : q.from) ?? ""} min={1900} max={2100} placeholder="1990" className="input w-24" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">To year</span>
        <input type="number" name={`${p}to`} defaultValue={(section === "episodes" ? q.eto : q.to) ?? ""} min={1900} max={2100} placeholder="2026" className="input w-24" />
      </label>

      {section === "shows" && (
        <div className="flex flex-col gap-1 pb-1">
          <label className="flex items-center gap-2"><input type="checkbox" name="all" value="1" defaultChecked={q.all} className="accent-accent" /> Include talk / news / reality</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="singles" value="1" defaultChecked={q.singles} className="accent-accent" /> Include 1-episode credits</label>
        </div>
      )}

      <button type="submit" className="btn-primary">Apply</button>
    </form>
  );
}
