-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "creditsFetchedAt" DATETIME;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN "creditsFetchedAt" DATETIME;
ALTER TABLE "Season" ADD COLUMN "episodeCreditsScannedAt" DATETIME;

-- AlterTable
ALTER TABLE "Show" ADD COLUMN "creditsFetchedAt" DATETIME;
ALTER TABLE "Show" ADD COLUMN "episodeCreditsScannedAt" DATETIME;
ALTER TABLE "Show" ADD COLUMN "numberOfEpisodes" INTEGER;

-- CreateTable
CREATE TABLE "Person" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "profilePath" TEXT,
    "knownForDepartment" TEXT,
    "biography" TEXT,
    "birthday" TEXT,
    "deathday" TEXT,
    "placeOfBirth" TEXT,
    "fetchedAt" DATETIME,
    "filmographyFetchedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,
    "seasonId" INTEGER,
    "episodeId" INTEGER,
    "kind" TEXT NOT NULL,
    "character" TEXT,
    "job" TEXT,
    "department" TEXT,
    "order" INTEGER,
    "episodeCount" INTEGER,
    CONSTRAINT "Credit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credit_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonTvCredit" (
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
    CONSTRAINT "PersonTvCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonTvCredit_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "Credit_showId_seasonId_episodeId_idx" ON "Credit"("showId", "seasonId", "episodeId");

-- CreateIndex
CREATE INDEX "Credit_personId_episodeId_idx" ON "Credit"("personId", "episodeId");

-- CreateIndex
CREATE INDEX "Credit_episodeId_idx" ON "Credit"("episodeId");

-- CreateIndex
CREATE INDEX "Credit_seasonId_idx" ON "Credit"("seasonId");

-- CreateIndex
CREATE INDEX "PersonTvCredit_personId_idx" ON "PersonTvCredit"("personId");

-- CreateIndex
CREATE INDEX "PersonTvCredit_showId_idx" ON "PersonTvCredit"("showId");
