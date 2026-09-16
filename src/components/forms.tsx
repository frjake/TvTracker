"use client";

import { useFormStatus } from "react-dom";

/** Hidden inputs identifying an episode (or, without episodeNumber, a season). */
export function TargetFields({
  showId,
  seasonNumber,
  episodeNumber,
}: {
  showId: number;
  seasonNumber: number;
  episodeNumber?: number;
}) {
  return (
    <>
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="seasonNumber" value={seasonNumber} />
      {episodeNumber != null && <input type="hidden" name="episodeNumber" value={episodeNumber} />}
    </>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className = "btn-secondary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
