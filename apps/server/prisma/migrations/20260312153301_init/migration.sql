-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ambience" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JournalAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalAnalysis_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "JournalAnalysis_journalEntryId_key" ON "JournalAnalysis"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalAnalysis_textHash_idx" ON "JournalAnalysis"("textHash");
