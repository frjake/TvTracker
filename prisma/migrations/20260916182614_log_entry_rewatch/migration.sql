-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "watchedAt" DATETIME NOT NULL,
    "rating" INTEGER,
    "reviewText" TEXT,
    "rewatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LogEntry_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LogEntry" ("createdAt", "episodeId", "id", "rating", "reviewText", "userId", "watchedAt") SELECT "createdAt", "episodeId", "id", "rating", "reviewText", "userId", "watchedAt" FROM "LogEntry";
DROP TABLE "LogEntry";
ALTER TABLE "new_LogEntry" RENAME TO "LogEntry";
CREATE INDEX "LogEntry_userId_watchedAt_idx" ON "LogEntry"("userId", "watchedAt");
CREATE INDEX "LogEntry_episodeId_idx" ON "LogEntry"("episodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
