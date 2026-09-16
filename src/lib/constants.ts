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
