"use client";

import { useState } from "react";
import { rateItem } from "@/app/actions/watch";
import { RATING_MAX, RATING_MIN } from "@/lib/constants";
import { SubmitButton, TargetFields } from "./forms";

/** Slider + number input for a 0-100 % rating. Empty value clears the rating. */
export function RatingControl({
  showId,
  seasonNumber,
  episodeNumber,
  current,
  label,
}: {
  showId: number;
  seasonNumber: number;
  episodeNumber?: number;
  current: number | null;
  label: string;
}) {
  const [value, setValue] = useState<number>(current ?? 70);

  return (
    <form action={rateItem} className="card flex flex-col gap-3">
      <TargetFields showId={showId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} />
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="text-sm text-muted">{current != null ? `You rated ${current}%` : "Not rated yet"}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label={`${label} slider`}
          className="flex-1 accent-accent"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            name="value"
            min={RATING_MIN}
            max={RATING_MAX}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={`${label} percent`}
            className="input w-20 text-right"
          />
          <span className="text-sm text-muted">%</span>
        </div>
      </div>
      <div className="flex gap-2">
        <SubmitButton className="btn-primary" pendingText="Saving…">
          {current != null ? "Update rating" : "Save rating"}
        </SubmitButton>
        {current != null && (
          <button
            type="submit"
            name="value"
            value=""
            className="btn-secondary"
            formNoValidate
            title="Remove your rating"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
