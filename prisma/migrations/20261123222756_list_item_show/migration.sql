-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "episodeId" INTEGER,
    "seasonId" INTEGER,
    "showId" INTEGER,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ListItem" ("createdAt", "episodeId", "id", "listId", "note", "position", "seasonId") SELECT "createdAt", "episodeId", "id", "listId", "note", "position", "seasonId" FROM "ListItem";
DROP TABLE "ListItem";
ALTER TABLE "new_ListItem" RENAME TO "ListItem";
CREATE INDEX "ListItem_listId_position_idx" ON "ListItem"("listId", "position");
CREATE UNIQUE INDEX "ListItem_listId_episodeId_key" ON "ListItem"("listId", "episodeId");
CREATE UNIQUE INDEX "ListItem_listId_seasonId_key" ON "ListItem"("listId", "seasonId");
CREATE UNIQUE INDEX "ListItem_listId_showId_key" ON "ListItem"("listId", "showId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
