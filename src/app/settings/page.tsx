import { requireUser } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted">Signed in as {user.username} · {user.email}</p>
      <ProfileForm user={user} />
      <PasswordForm />
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Export your data</h2>
        <p className="text-sm text-muted">
          Download everything in your account as CSV files in a single .zip: your profile, diary, watched
          episodes, ratings, reviews, followers and following, plus one file for each of your lists.
        </p>
        <a href="/settings/export" download className="btn-secondary self-start">Download account data (.zip)</a>
      </section>
    </div>
  );
}
