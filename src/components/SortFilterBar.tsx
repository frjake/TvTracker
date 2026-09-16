"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { type FilmographyQuery, coerceYearRange, filmographyHref } from "@/lib/people";

/**
 * Filters for a person's shows or episodes. Every control applies immediately by navigating
 * to the matching URL (server-rendered results, scroll kept). Sorting lives in the table
 * headers; the current sort and the other section's filters are preserved because the href
 * is built from the whole query object.
 */
export function SortFilterBar({
  q,
  section,
  signedIn,
  base,
  showOptions = [],
}: {
  q: FilmographyQuery;
  section: "shows" | "episodes";
  signedIn: boolean;
  base: string;
  showOptions?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (overrides: Partial<FilmographyQuery>) => {
    startTransition(() => {
      router.replace(`${filmographyHref(base, q, overrides)}#${section}`, { scroll: false });
    });
  };

  const isShows = section === "shows";
  const fromKey = isShows ? "from" : "efrom";
  const toKey = isShows ? "to" : "eto";
  const from = isShows ? q.from : q.efrom;
  const to = isShows ? q.to : q.eto;

  // Changing one end past the other moves the other end to the new value.
  const applyYear = (changed: "from" | "to", value: number | null) => {
    const range = coerceYearRange(changed, value, from, to);
    apply({ [fromKey]: range.from, [toKey]: range.to });
  };

  return (
    <div
      className={`card flex flex-wrap items-end gap-3 text-sm transition-opacity ${pending ? "opacity-60" : ""}`}
      id={`${section}-filters`}
      aria-busy={pending}
    >
      {isShows ? (
        <>
          <Select
            label="Watched"
            value={q.watched}
            defaultValue="any"
            disabled={!signedIn}
            onChange={(v) => apply({ watched: v as FilmographyQuery["watched"] })}
            options={[
              ["any", "Any"],
              ["not_started", "Not started"],
              ["in_progress", "In progress"],
              ["completed", "Completed"],
            ]}
          />
          <Select
            label="Role"
            value={q.dept}
            defaultValue="all"
            onChange={(v) => apply({ dept: v as FilmographyQuery["dept"] })}
            options={[
              ["all", "All"],
              ["cast", "Cast"],
              ["crew", "Crew"],
            ]}
          />
        </>
      ) : (
        <>
          <Select
            label="Watched"
            value={q.ewatched}
            defaultValue="any"
            disabled={!signedIn}
            onChange={(v) => apply({ ewatched: v as FilmographyQuery["ewatched"] })}
            options={[
              ["any", "Any"],
              ["watched", "Watched"],
              ["unwatched", "Unwatched"],
            ]}
          />
          {showOptions.length > 1 && (
            <Select
              label="Show"
              value={q.eshow == null ? "" : String(q.eshow)}
              defaultValue=""
              onChange={(v) => apply({ eshow: v ? Number(v) : null })}
              options={[["", "All shows"], ...showOptions.map((s) => [String(s.id), s.name] as [string, string])]}
            />
          )}
        </>
      )}

      <YearInput key={`from-${from}`} label="From year" value={from} placeholder="1990" onCommit={(v) => applyYear("from", v)} />
      <YearInput key={`to-${to}`} label="To year" value={to} placeholder="2026" onCommit={(v) => applyYear("to", v)} />

      {isShows && (
        <div className="flex flex-col gap-1 pb-1">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={q.all} onChange={(e) => apply({ all: e.target.checked })} className="accent-accent" />
            Include talk / news / reality
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={q.singles} onChange={(e) => apply({ singles: e.target.checked })} className="accent-accent" />
            Include 1-episode credits
          </label>
        </div>
      )}
    </div>
  );
}

/** Small × that resets a control to its default; dimmed and inert when already there. */
function ClearButton({ label, active, disabled, onClear }: { label: string; active: boolean; disabled?: boolean; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={!active || disabled}
      aria-label={`Clear ${label} filter`}
      title={active ? `Clear ${label}` : undefined}
      className={`h-8 w-6 rounded text-base leading-none ${active ? "text-muted hover:bg-background hover:text-foreground" : "text-muted opacity-30"}`}
    >
      ×
    </button>
  );
}

/** Dropdown with a small × on its left that resets it to the default value. */
function Select({
  label,
  value,
  defaultValue,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  defaultValue: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const active = value !== defaultValue;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <ClearButton label={label} active={active} disabled={disabled} onClear={() => onChange(defaultValue)} />
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="input w-36">
          {options.map(([v, text]) => (
            <option key={v} value={v}>{text}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Year box with a clearing ×; applies after a short pause in typing, on blur, or on Enter. */
function YearInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onCommit: (value: number | null) => void;
}) {
  // The parent keys this component on `value`, so an external change (URL edit) remounts it.
  const [text, setText] = useState(value == null ? "" : String(value));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (raw: string) => {
    const n = Number(raw);
    const next = raw && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
    if (next !== value) onCommit(next);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1">
      <ClearButton label={label} active={value != null} onClear={() => { if (timer.current) clearTimeout(timer.current); onCommit(null); }} />
      <input
        type="number"
        value={text}
        min={1900}
        max={2100}
        placeholder={placeholder}
        className="input w-24"
        onChange={(e) => {
          setText(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const raw = e.target.value;
          timer.current = setTimeout(() => commit(raw), 500);
        }}
        onBlur={(e) => {
          if (timer.current) clearTimeout(timer.current);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            commit((e.target as HTMLInputElement).value);
          }
        }}
      />
      </span>
    </label>
  );
}
