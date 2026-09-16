-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Show" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "firstAirDate" TEXT,
    "status" TEXT,
    "numberOfSeasons" INTEGER,
    "tmdbVoteAverage" REAL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "showId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "posterPath" TEXT,
    "airDate" TEXT,
    "episodeCount" INTEGER,
    "tmdbVoteAverage" REAL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "episodesFetchedAt" DATETIME,
    CONSTRAINT "Season_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "showId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "stillPath" TEXT,
    "airDate" TEXT,
    "runtime" INTEGER,
    "tmdbVoteAverage" REAL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Episode_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "watchedAt" DATETIME NOT NULL,
    "rating" INTEGER,
    "reviewText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LogEntry_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER,
    "seasonId" INTEGER,
    "value" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rating_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rating_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER,
    "seasonId" INTEGER,
    "body" TEXT NOT NULL,
    "containsSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchedMark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchedMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchedMark_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "episodeId" INTEGER,
    "seasonId" INTEGER,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "episodeId" INTEGER,
    "seasonId" INTEGER,
    "listId" TEXT,
    "logEntryId" TEXT,
    "ratingId" TEXT,
    "reviewId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_showId_seasonNumber_key" ON "Season"("showId", "seasonNumber");

-- CreateIndex
CREATE INDEX "Episode_seasonId_idx" ON "Episode"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_showId_seasonNumber_episodeNumber_key" ON "Episode"("showId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "LogEntry_userId_watchedAt_idx" ON "LogEntry"("userId", "watchedAt");

-- CreateIndex
CREATE INDEX "LogEntry_episodeId_idx" ON "LogEntry"("episodeId");

-- CreateIndex
CREATE INDEX "Rating_episodeId_idx" ON "Rating"("episodeId");

-- CreateIndex
CREATE INDEX "Rating_seasonId_idx" ON "Rating"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_episodeId_key" ON "Rating"("userId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_seasonId_key" ON "Rating"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "Review_episodeId_idx" ON "Review"("episodeId");

-- CreateIndex
CREATE INDEX "Review_seasonId_idx" ON "Review"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_episodeId_key" ON "Review"("userId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_seasonId_key" ON "Review"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "WatchedMark_episodeId_idx" ON "WatchedMark"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedMark_userId_episodeId_key" ON "WatchedMark"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "List_userId_idx" ON "List"("userId");

-- CreateIndex
CREATE INDEX "ListItem_listId_position_idx" ON "ListItem"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_episodeId_key" ON "ListItem"("listId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_seasonId_key" ON "ListItem"("listId", "seasonId");

-- CreateIndex
CREATE INDEX "Follow_followingId_status_idx" ON "Follow"("followingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");
