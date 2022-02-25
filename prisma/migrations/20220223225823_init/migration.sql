-- CreateTable
CREATE TABLE "Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "time" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL
);
