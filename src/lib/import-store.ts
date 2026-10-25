import "server-only";

import { randomBytes } from "node:crypto";

// Holds an uploaded export between "Preview" and "Import" so the file needn't be re-uploaded.
// In memory on purpose: a restart just means uploading again. Entries expire after 30 minutes.

interface PendingImport {
  userId: string;
  fileName: string;
  bytes: Uint8Array;
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 20;

const g = globalThis as unknown as { tvtrackerImports?: Map<string, PendingImport> };
const store = (g.tvtrackerImports ??= new Map());

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [token, entry] of store) if (entry.createdAt < cutoff) store.delete(token);
  while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
}

export function stashUpload(userId: string, fileName: string, bytes: Uint8Array): string {
  prune();
  for (const [token, entry] of store) if (entry.userId === userId) store.delete(token); // one pending import per user
  const token = randomBytes(18).toString("base64url");
  store.set(token, { userId, fileName, bytes, createdAt: Date.now() });
  return token;
}

/** The pending upload for this token, only if it belongs to this user and hasn't expired. */
export function getUpload(token: string, userId: string): PendingImport | null {
  prune();
  const entry = store.get(token);
  return entry && entry.userId === userId ? entry : null;
}

export function dropUpload(token: string) {
  store.delete(token);
}
