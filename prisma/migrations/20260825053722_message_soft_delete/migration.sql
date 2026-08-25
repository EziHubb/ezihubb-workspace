-- Withdrawing a message is soft: the buyer may already have read it, so the
-- thread shows that something was withdrawn rather than a gap, and a
-- moderation report about it stays answerable. The body is kept here as
-- evidence, but the API stops sending it once deletedAt is set.
ALTER TABLE "Message" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedBy" TEXT;
