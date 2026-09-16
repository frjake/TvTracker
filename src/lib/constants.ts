// String-valued "enums" stored in SQLite text columns (see prisma/schema.prisma).

export const FOLLOW_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
} as const;
export type FollowStatus = (typeof FOLLOW_STATUS)[keyof typeof FOLLOW_STATUS];

export const ACTIVITY_TYPE = {
  LOG: "LOG",
  RATING: "RATING",
  REVIEW: "REVIEW",
  LIST_CREATED: "LIST_CREATED",
} as const;
export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];

export const SESSION_COOKIE = "tvtracker_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const RATING_MIN = 0;
export const RATING_MAX = 100;

/** TMDB cache rows older than this are refreshed on next read. */
export const TMDB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- People / credits ----------

export const CREDIT_KIND = { CAST: "cast", GUEST: "guest", CREW: "crew" } as const;
export type CreditKind = (typeof CREDIT_KIND)[keyof typeof CREDIT_KIND];

/**
 * Crew we cache and display. TMDB files assistant directors, script supervisors, story
 * editors etc. under "Directing"/"Writing", so this is a job allowlist, not a department one.
 */
export const KEY_CREW_JOBS = new Set(["Director", "Writer", "Story", "Teleplay", "Creator", "Executive Producer"]);

/** TMDB TV genre ids hidden from filmographies by default: Talk, News, Reality. */
export const NOISE_GENRE_IDS = new Set([10767, 10763, 10764]);

/** Shows with more episodes than this get per-season scan buttons instead of one whole-show scan. */
export const SCAN_MAX_EPISODES = 300;
/** Episode credit requests issued concurrently during a scan. */
export const SCAN_BATCH = 10;
