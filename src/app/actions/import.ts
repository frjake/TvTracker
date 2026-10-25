"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ImportProblem } from "@/lib/import-parse";
import { ImportError, type ImportSummary, MAX_UPLOAD_BYTES, executeImport, planImport, readExportZip } from "@/lib/import";
import { dropUpload, getUpload, stashUpload } from "@/lib/import-store";

const MAX_PROBLEMS_SHOWN = 100;

export type ImportState =
  | { stage: "idle" }
  | { stage: "error"; message: string }
  | { stage: "preview"; token: string; fileName: string; summary: ImportSummary; problems: ImportProblem[]; problemCount: number }
  | { stage: "done"; summary: ImportSummary; problemCount: number };

/**
 * One action drives the whole flow via the "intent" field:
 *  preview — read the uploaded zip, plan the merge, stash the file; nothing is written.
 *  confirm — re-plan the stashed file against the account as it is now, then write it.
 *  cancel  — forget the stashed file.
 */
export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser("/settings/import");
  const intent = formData.get("intent");

  if (intent === "cancel") {
    const token = formData.get("token");
    if (typeof token === "string") dropUpload(token);
    return { stage: "idle" };
  }

  try {
    if (intent === "preview") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) return { stage: "error", message: "Choose your TvTracker export (.zip) first." };
      if (file.size > MAX_UPLOAD_BYTES) return { stage: "error", message: "That file is larger than 10 MB." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const plan = await planImport(user.id, readExportZip(bytes));
      if (plan.summary.recognized.length === 0) {
        return { stage: "error", message: "That zip doesn't contain a TvTracker export (no diary.csv, watched.csv, ratings.csv, reviews.csv or lists)." };
      }
      return {
        stage: "preview",
        token: stashUpload(user.id, file.name, bytes),
        fileName: file.name,
        summary: plan.summary,
        problems: plan.problems.slice(0, MAX_PROBLEMS_SHOWN),
        problemCount: plan.problems.length,
      };
    }

    if (intent === "confirm") {
      const token = formData.get("token");
      const pending = typeof token === "string" ? getUpload(token, user.id) : null;
      if (!pending || typeof token !== "string") return { stage: "error", message: "This preview has expired. Upload the file again." };
      const plan = await planImport(user.id, readExportZip(pending.bytes));
      await executeImport(user.id, plan);
      dropUpload(token);
      revalidatePath("/", "layout");
      return { stage: "done", summary: plan.summary, problemCount: plan.problems.length };
    }
  } catch (err) {
    if (err instanceof ImportError) return { stage: "error", message: err.message };
    throw err;
  }

  return { stage: "idle" };
}
