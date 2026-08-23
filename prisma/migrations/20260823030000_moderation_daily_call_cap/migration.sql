-- Lower the moderation daily API-call ceiling from 10000 to 500.
--
-- Every product save queues up to 7 Claude calls (title, description, and up
-- to 5 images), at roughly $0.01 for an image check. A 10000 ceiling therefore
-- allowed about $100 of spend in a day before anything stopped it — a bulk
-- import or an edit loop could reach that without anyone noticing. 500 sits
-- well above normal traffic and caps a runaway near $6.
--
-- Only rows still carrying the old default are moved. The value is editable in
-- Moderation → Settings, and someone who deliberately chose a number should
-- keep it — this migration must not overwrite a decision, only a default
-- nobody made.

ALTER TABLE "ModerationSettings" ALTER COLUMN "maxDailyApiCalls" SET DEFAULT 500;

UPDATE "ModerationSettings"
SET "maxDailyApiCalls" = 500
WHERE "maxDailyApiCalls" = 10000;
