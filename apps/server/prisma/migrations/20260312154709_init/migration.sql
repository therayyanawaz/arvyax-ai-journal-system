-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT,
    "emotion" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalAnalysis_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JournalAnalysis" ("createdAt", "emotion", "id", "journalEntryId", "keywordsJson", "summary", "textHash") SELECT "createdAt", "emotion", "id", "journalEntryId", "keywordsJson", "summary", "textHash" FROM "JournalAnalysis";
DROP TABLE "JournalAnalysis";
ALTER TABLE "new_JournalAnalysis" RENAME TO "JournalAnalysis";
CREATE UNIQUE INDEX "JournalAnalysis_journalEntryId_key" ON "JournalAnalysis"("journalEntryId");
CREATE INDEX "JournalAnalysis_textHash_idx" ON "JournalAnalysis"("textHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
