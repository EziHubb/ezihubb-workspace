-- Idempotency key for message sends, chosen by the client before the request
-- leaves, so a retry after a timeout is recognised instead of duplicated.
--
-- Nullable and scoped to the conversation: Postgres permits repeated NULLs in a
-- unique index, so every existing row and any caller that does not supply one
-- still inserts freely.
ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "Message_conversationId_clientMessageId_key"
  ON "Message"("conversationId", "clientMessageId");
