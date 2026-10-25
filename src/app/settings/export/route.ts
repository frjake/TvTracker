import { strToU8, zipSync } from "fflate";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { todayString } from "@/lib/dates";
import { buildAccountExport } from "@/lib/export";

/**
 * GET /settings/export — downloads the signed-in user's data as a zip of CSV files
 * (Letterboxd-style). Only ever exports the requester's own account.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  const files = await buildAccountExport(user.id);
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])), { level: 6 });
  const filename = `tvtracker-${user.username}-${todayString()}.zip`;

  return new Response(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
