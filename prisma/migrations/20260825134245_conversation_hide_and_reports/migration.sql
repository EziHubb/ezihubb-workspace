-- A buyer can take a thread off their own list, and can report one.
--
-- The hide is deliberately not a delete. The shop is the other party to the
-- conversation and keeps its copy -- the same reason unsending a message
-- blanks it rather than dropping the row. Nullable, so every existing thread
-- starts visible.
ALTER TABLE "Conversation" ADD COLUMN "hiddenByCustomerAt" TIMESTAMP(3);

CREATE TYPE "ConversationReportReason" AS ENUM (
  'SPAM',
  'HARASSMENT',
  'SCAM',
  'OFF_PLATFORM',
  'INAPPROPRIATE',
  'OTHER'
);

-- Separate from ModerationLog on purpose. That table records what an automated
-- check concluded -- confidence, provider, model version, cost per call -- and
-- a human report has none of those; writing one in would mean inventing the
-- numbers.
CREATE TABLE "ConversationReport" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    -- Null for a guest, who has no account. The conversation still identifies
    -- them, so a reviewer is never looking at an anonymous complaint.
    "reportedById"   TEXT,
    "reason"         "ConversationReportReason" NOT NULL,
    "note"           TEXT,
    "resolvedAt"     TIMESTAMP(3),
    "reviewedBy"     TEXT,
    "adminNotes"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationReport_conversationId_idx" ON "ConversationReport"("conversationId");
-- The reviewer's working query is "what is still open, oldest first".
CREATE INDEX "ConversationReport_resolvedAt_createdAt_idx" ON "ConversationReport"("resolvedAt", "createdAt");

ALTER TABLE "ConversationReport"
  ADD CONSTRAINT "ConversationReport_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
