-- Marketplace Insights (Phase 1): saved searches — a seller "watchlisting"
-- a keyword to revisit its trend later.

-- CreateTable
CREATE TABLE "SavedSearchTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearchTerm_userId_idx" ON "SavedSearchTerm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearchTerm_userId_term_key" ON "SavedSearchTerm"("userId", "term");

-- AddForeignKey
ALTER TABLE "SavedSearchTerm" ADD CONSTRAINT "SavedSearchTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
