"use client";

import { useActionState } from "react";
import { type SettingsState, changePassword, updateProfile } from "@/app/actions/settings";

function Status({ state }: { state: SettingsState }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-accent">Saved.</p>;
  return null;
}

export function ProfileForm({ user }: { user: { displayName: string | null; bio: string | null; isPrivate: boolean } }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <h2 className="font-semibold">Profile</h2>
      <div>
        <label htmlFor="displayName" className="label">Display name</label>
        <input id="displayName" name="displayName" defaultValue={user.displayName ?? ""} maxLength={50} className="input mt-1" />
      </div>
      <div>
        <label htmlFor="bio" className="label">Bio</label>
        <textarea id="bio" name="bio" defaultValue={user.bio ?? ""} rows={3} maxLength={300} className="input mt-1" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="isPrivate" defaultChecked={user.isPrivate} className="mt-0.5 accent-accent" />
        <span>
          <span className="font-medium">Private account</span>
          <span className="block text-muted">
            New followers must be approved, and only followers can see your profile, log, reviews and lists. Your ratings still count toward community averages anonymously.
          </span>
        </span>
      </label>
      <Status state={state} />
      <button type="submit" className="btn-primary self-start" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <h2 className="font-semibold">Change password</h2>
      <div>
        <label htmlFor="current" className="label">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input mt-1" />
      </div>
      <div>
        <label htmlFor="next" className="label">New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} className="input mt-1" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className="input mt-1" />
      </div>
      <Status state={state} />
      <button type="submit" className="btn-primary self-start" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}
