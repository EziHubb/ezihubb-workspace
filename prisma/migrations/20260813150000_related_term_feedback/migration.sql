-- Marketplace Insights (Phase 3): thumbs up/down on "similar search term"
-- suggestions, used by SearchService.getRelated() to re-rank/filter future
-- suggestions for the same source term.

-- CreateTable
CREATE TABLE "RelatedTermFeedback" (
    "id" TEXT NOT NULL,
    "sourceTerm" TEXT NOT NULL,
    "relatedTerm" TEXT NOT NULL,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatedTermFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatedTermFeedback_sourceTerm_idx" ON "RelatedTermFeedback"("sourceTerm");

-- CreateIndex
CREATE UNIQUE INDEX "RelatedTermFeedback_sourceTerm_relatedTerm_key" ON "RelatedTermFeedback"("sourceTerm", "relatedTerm");
