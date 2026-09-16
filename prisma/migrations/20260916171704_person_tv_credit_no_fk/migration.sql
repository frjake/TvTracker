-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PersonTvCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "character" TEXT,
    "job" TEXT,
    "department" TEXT,
    "episodeCount" INTEGER NOT NULL,
    "showName" TEXT NOT NULL,
    "posterPath" TEXT,
    "firstAirDate" TEXT,
    "tmdbVoteAverage" REAL,
    "genreIds" TEXT NOT NULL,
    CONSTRAINT "PersonTvCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PersonTvCredit" ("character", "department", "episodeCount", "firstAirDate", "genreIds", "id", "job", "kind", "personId", "posterPath", "showId", "showName", "tmdbVoteAverage") SELECT "character", "department", "episodeCount", "firstAirDate", "genreIds", "id", "job", "kind", "personId", "posterPath", "showId", "showName", "tmdbVoteAverage" FROM "PersonTvCredit";
DROP TABLE "PersonTvCredit";
ALTER TABLE "new_PersonTvCredit" RENAME TO "PersonTvCredit";
CREATE INDEX "PersonTvCredit_personId_idx" ON "PersonTvCredit"("personId");
CREATE INDEX "PersonTvCredit_showId_idx" ON "PersonTvCredit"("showId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
