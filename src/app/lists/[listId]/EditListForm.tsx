"use client";

import { useActionState, useState } from "react";
import { type ListFormState, deleteList, updateList } from "@/app/actions/lists";

export function EditListForm({ list }: { list: { id: string; name: string; description: string | null } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ListFormState, FormData>(updateList, undefined);

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Edit list
      </button>
    );
  }

  return (
    <div className="card flex w-full max-w-lg flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={list.id} />
        <div>
          <label htmlFor="edit-name" className="label">Name</label>
          <input id="edit-name" name="name" defaultValue={list.name} className="input mt-1" required maxLength={100} />
        </div>
        <div>
          <label htmlFor="edit-description" className="label">Description</label>
          <textarea id="edit-description" name="description" defaultValue={list.description ?? ""} rows={3} className="input mt-1" maxLength={2000} />
        </div>
        {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        {state?.ok && <p className="text-sm text-accent">Saved.</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Close</button>
        </div>
      </form>
      <form
        action={deleteList}
        onSubmit={(e) => {
          if (!confirm("Delete this list? This cannot be undone.")) e.preventDefault();
        }}
        className="self-start"
      >
        <input type="hidden" name="id" value={list.id} />
        <button type="submit" className="text-sm text-muted underline hover:text-red-600">Delete list</button>
      </form>
    </div>
  );
}
