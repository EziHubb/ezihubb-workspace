-- Presence survives an API restart only as "last seen"; live online state
-- lives in Redis and is meant to be lost when the process dies.
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
