"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type ImportState, importAction } from "@/app/actions/import";
import type { ImportSummary, SectionSummary } from "@/lib/import";

function SummaryTable({ summary, done }: { summary: ImportSummary; done: boolean }) {
  const rows: [string, SectionSummary][] = [
    ["Diary entries", summary.diary],
    ["Watched episodes", summary.watched],
    ["Ratings", summary.ratings],
    ["Reviews", summary.reviews],
    ["List items", summary.listItems],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2 text-right">In file</th>
            <th className="px-3 py-2 text-right">{done ? "Added" : "Will add"}</th>
            <th className="px-3 py-2 text-right">Already there</th>
            <th className="px-3 py-2 text-right">Problems</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, s]) => (
            <tr key={label} className="border-t border-line">
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{s.total}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-accent">{s.add}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{s.skip}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.problems ? "text-red-600 dark:text-red-400" : "text-muted"}`}>{s.problems}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        Lists: {summary.listsNew} new, {summary.listsExisting} matched an existing list by name (missing items are appended).
        {summary.ignored.length > 0 && ` Not imported: ${summary.ignored.join(", ")}.`}
      </p>
    </div>
  );
}

export function ImportFlow() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, { stage: "idle" });

  if (state.stage === "preview") {
    const nothingToAdd = [state.summary.diary, state.summary.watched, state.summary.ratings, state.summary.reviews, state.summary.listItems].every((s) => s.add === 0) && state.summary.listsNew === 0;
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={state.token} />
        <p className="text-sm">
          Preview of <span className="font-medium">{state.fileName}</span>. Nothing has been changed yet.
        </p>
        <SummaryTable summary={state.summary} done={false} />
        {state.problemCount > 0 && (
          <details className="card text-sm" open={state.problemCount <= 10}>
            <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
              {state.problemCount} row{state.problemCount === 1 ? "" : "s"} will be skipped
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {state.problems.map((p, i) => (
                <li key={i}>
                  <span className="font-mono text-muted">{p.file}{p.row != null ? ` row ${p.row}` : ""}</span> — {p.message}
                </li>
              ))}
              {state.problemCount > state.problems.length && <li className="text-muted">…and {state.problemCount - state.problems.length} more</li>}
            </ul>
          </details>
        )}
        <div className="flex gap-2">
          <button type="submit" name="intent" value="confirm" className="btn-primary" disabled={pending || nothingToAdd}>
            {pending ? "Importing…" : nothingToAdd ? "Nothing new to import" : "Import"}
          </button>
          <button type="submit" name="intent" value="cancel" className="btn-secondary" disabled={pending}>Cancel</button>
        </div>
      </form>
    );
  }

  if (state.stage === "done") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <p className="text-sm font-medium text-accent">Import complete.</p>
        <SummaryTable summary={state.summary} done />
        {state.problemCount > 0 && <p className="text-xs text-muted">{state.problemCount} row{state.problemCount === 1 ? " was" : "s were"} skipped because they couldn&apos;t be read or matched.</p>}
        <div className="flex flex-wrap gap-2">
          <Link href="/log" className="btn-secondary">View your log</Link>
          <button type="submit" name="intent" value="cancel" className="btn-secondary">Import another file</button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="intent" value="preview" />
      <label className="flex flex-col gap-1">
        <span className="label">TvTracker export (.zip)</span>
        <input type="file" name="file" accept=".zip,application/zip" required className="input" />
      </label>
      {state.stage === "error" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}
      <button type="submit" className="btn-primary self-start" disabled={pending}>
        {pending ? "Reading file… (large imports can take a minute)" : "Preview import"}
      </button>
    </form>
  );
}
