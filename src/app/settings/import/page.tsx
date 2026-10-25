import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ImportFlow } from "./ImportFlow";

export const metadata = { title: "Import data" };

export default async function ImportPage() {
  await requireUser("/settings/import");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href="/settings" className="hover:underline">Settings</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Import data</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Import data</h1>
      <div className="card flex flex-col gap-2 text-sm text-muted">
        <p>
          Upload a .zip from <span className="text-foreground">Settings → Export your data</span> to add its diary entries,
          watched episodes, ratings, reviews and lists to this account.
        </p>
        <ul className="list-disc pl-5">
          <li>Nothing already in your account is changed or removed; duplicates are skipped, so importing the same file twice is safe.</li>
          <li>A diary entry is a duplicate when the same episode was logged on the same date. Existing ratings and reviews are kept.</li>
          <li>Lists with the same name get the missing items added at the end.</li>
          <li>Profile details, followers and following in the file are not imported. Imported entries don&apos;t appear in anyone&apos;s feed.</li>
        </ul>
        <p>You&apos;ll see a preview before anything is written.</p>
      </div>
      <div className="card">
        <ImportFlow />
      </div>
    </div>
  );
}
