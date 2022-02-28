/*
  Warnings:

  - Added the required column `expired` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "time" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "expired" BOOLEAN NOT NULL
);
INSERT INTO "new_Event" ("id", "payload", "time", "webhook_url") SELECT "id", "payload", "time", "webhook_url" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
