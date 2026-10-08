-- Prospective audit only. No DEAD reset, provider dispatch or history backfill.
CREATE TABLE "EconomicLifecycleRecovery" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12),
  "eventId" TEXT NOT NULL UNIQUE REFERENCES "EconomicOutbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "applied" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim("actorId")) > 0 AND length(trim("reason")) > 0)
);
CREATE TRIGGER "EconomicLifecycleRecovery_immutable" BEFORE UPDATE OR DELETE ON "EconomicLifecycleRecovery"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE FUNCTION economic_lifecycle_recovery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EconomicOutbox"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM "EconomicOutbox" WHERE "id"=NEW."eventId" FOR UPDATE;
  IF e."state" <> 'DEAD' OR e."eventType" NOT IN ('capture.verified.v1','refund.verified.v1')
    OR NOT EXISTS (SELECT 1 FROM "EconomicConsumerReceipt" WHERE "eventId"=e."id" AND "consumer"='lifecycle.v1') THEN
    RAISE EXCEPTION 'Lifecycle recovery requires a terminal event and atomic consumer receipt';
  END IF;
  IF e."eventType"='capture.verified.v1' AND NOT EXISTS (
    SELECT 1 FROM "EconomicCapture" c WHERE c."contextId"=e."contextId" AND c."operationId"=e."payload"->>'operationId'
  ) THEN RAISE EXCEPTION 'Lifecycle recovery requires original capture proof'; END IF;
  IF e."eventType"='refund.verified.v1' AND NOT EXISTS (
    SELECT 1 FROM "EconomicRefund" f JOIN "EconomicRefundRequest" r ON r."id"=f."requestId"
      JOIN "EconomicCapture" c ON c."id"=r."captureId"
    WHERE c."contextId"=e."contextId" AND r."operationId"=e."payload"->>'operationId'
  ) THEN RAISE EXCEPTION 'Lifecycle recovery requires original refund proof'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicLifecycleRecovery_guard" BEFORE INSERT ON "EconomicLifecycleRecovery"
  FOR EACH ROW EXECUTE FUNCTION economic_lifecycle_recovery_guard();
