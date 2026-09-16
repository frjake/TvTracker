import { requireUser } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted">Signed in as @{user.username} · {user.email}</p>
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}
