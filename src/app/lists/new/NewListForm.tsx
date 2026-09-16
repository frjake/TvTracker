"use client";

import { useActionState } from "react";
import { type ListFormState, createList } from "@/app/actions/lists";

export function NewListForm() {
  const [state, action, pending] = useActionState<ListFormState, FormData>(createList, undefined);
  return (
    <form action={action} className="card mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">New list</h1>
      <div>
        <label htmlFor="name" className="label">Name</label>
        <input id="name" name="name" className="input mt-1" required maxLength={100} placeholder="e.g. Comfort episodes" />
      </div>
      <div>
        <label htmlFor="description" className="label">Description <span className="text-muted">(optional)</span></label>
        <textarea id="description" name="description" rows={3} className="input mt-1" maxLength={2000} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" className="btn-primary self-start" disabled={pending}>
        {pending ? "Creating…" : "Create list"}
      </button>
    </form>
  );
}
