-- Prospective private external intents and in-app receipts; no legacy replay.
CREATE TABLE "EconomicExternalEffect" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "contextId" TEXT NOT NULL REFERENCES "EconomicOrderContext"("id") ON DELETE RESTRICT,
  "effectKey" VARCHAR(64) NOT NULL UNIQUE, "kind" VARCHAR(30) NOT NULL,
  "storeOrderId" TEXT, "connectionId" TEXT, "providerAccount" VARCHAR(150) NOT NULL,
  "sourceEventId" TEXT, "payload" JSONB NOT NULL, "payloadHash" VARCHAR(64) NOT NULL,
  "requestedBy" TEXT NOT NULL, "reason" VARCHAR(500) NOT NULL,
  "state" "EconomicOperationState" NOT NULL DEFAULT 'PREPARED', "dispatchToken" VARCHAR(64),
  "dispatchedAt" TIMESTAMP(3), "providerReference" VARCHAR(150), "evidenceHash" VARCHAR(64),
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicExternalEffect_connectionId_providerReference_key" UNIQUE ("connectionId","providerReference"),
  CHECK ("effectKey" ~ '^[a-f0-9]{64}$' AND "payloadHash" ~ '^[a-f0-9]{64}$'),
  CHECK ("kind" IN ('POD_PRINTIFY','EMAIL_TRANSACTIONAL') AND jsonb_typeof("payload")='object'),
  CHECK (length(btrim("requestedBy")) BETWEEN 1 AND 150 AND "requestedBy"=btrim("requestedBy") AND length(btrim("reason"))>0),
  CHECK (("kind"='POD_PRINTIFY' AND "storeOrderId" IS NOT NULL AND "connectionId" IS NOT NULL AND "sourceEventId" IS NULL)
    OR ("kind"='EMAIL_TRANSACTIONAL' AND "storeOrderId" IS NULL AND "connectionId" IS NULL AND "sourceEventId" IS NOT NULL)),
  CHECK (("state"='PREPARED' AND "dispatchToken" IS NULL AND "dispatchedAt" IS NULL AND "providerReference" IS NULL AND "evidenceHash" IS NULL AND "completedAt" IS NULL)
    OR ("state" IN ('DISPATCHED','NEEDS_RECONCILIATION') AND "dispatchToken" IS NOT NULL AND "dispatchedAt" IS NOT NULL AND "evidenceHash" IS NULL AND "completedAt" IS NULL)
    OR ("state"='SUCCEEDED' AND "dispatchToken" IS NOT NULL AND "dispatchedAt" IS NOT NULL AND "providerReference" IS NOT NULL AND "evidenceHash" ~ '^[a-f0-9]{64}$' AND "completedAt" IS NOT NULL))
);
CREATE INDEX "EconomicExternalEffect_state_createdAt_idx" ON "EconomicExternalEffect"("state","createdAt");
CREATE INDEX "EconomicExternalEffect_contextId_idx" ON "EconomicExternalEffect"("contextId");
CREATE TABLE "EconomicNotificationReceipt" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "eventId" TEXT NOT NULL REFERENCES "EconomicOutbox"("id") ON DELETE RESTRICT,
  "recipientId" TEXT NOT NULL, "notificationId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicNotificationReceipt_eventId_recipientId_key" UNIQUE("eventId","recipientId")
);
CREATE FUNCTION economic_external_effect_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE context "EconomicOrderContext"%ROWTYPE; source "EconomicOutbox"%ROWTYPE; shop "StoreOrder"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'External dispatch evidence cannot be deleted'; END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW."id",NEW."contextId",NEW."effectKey",NEW."kind",NEW."storeOrderId",NEW."connectionId",NEW."providerAccount",
      NEW."sourceEventId",NEW."payload",NEW."payloadHash",NEW."requestedBy",NEW."reason",NEW."createdAt") IS DISTINCT FROM
      ROW(OLD."id",OLD."contextId",OLD."effectKey",OLD."kind",OLD."storeOrderId",OLD."connectionId",OLD."providerAccount",
      OLD."sourceEventId",OLD."payload",OLD."payloadHash",OLD."requestedBy",OLD."reason",OLD."createdAt") THEN
      RAISE EXCEPTION 'Original external intent is immutable';
    END IF;
    IF OLD."state"='SUCCEEDED' THEN RAISE EXCEPTION 'Terminal external evidence is immutable'; END IF;
    IF OLD."state"='PREPARED' THEN
      IF NEW."state"<>'DISPATCHED' OR NEW."providerReference" IS NOT NULL THEN RAISE EXCEPTION 'External intent must dispatch once without claimed provider proof'; END IF;
    ELSE
      IF NEW."state" NOT IN ('NEEDS_RECONCILIATION','SUCCEEDED')
        OR ROW(NEW."dispatchToken",NEW."dispatchedAt") IS DISTINCT FROM ROW(OLD."dispatchToken",OLD."dispatchedAt")
        OR (OLD."providerReference" IS NOT NULL AND NEW."providerReference" IS DISTINCT FROM OLD."providerReference") THEN
        RAISE EXCEPTION 'Ambiguous external dispatch cannot reset or change identity';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT context FROM "EconomicOrderContext" WHERE "id"=NEW."contextId" FOR UPDATE;
  IF NEW."state"<>'PREPARED' OR context."policyVersion"<>'2026-10-03.v1' THEN RAISE EXCEPTION 'Invalid prospective external intent'; END IF;
  IF NEW."kind"='EMAIL_TRANSACTIONAL' THEN
    SELECT * INTO STRICT source FROM "EconomicOutbox" WHERE "id"=NEW."sourceEventId";
    IF source."contextId"<>context."id" OR source."eventType" NOT IN ('capture.verified.v1','refund.verified.v1')
      OR NOT EXISTS (SELECT 1 FROM "EconomicConsumerReceipt" WHERE "eventId"=source."id" AND "consumer"='lifecycle.v1') THEN
      RAISE EXCEPTION 'Notification requires original lifecycle receipt';
    END IF;
  ELSE
    SELECT * INTO STRICT shop FROM "StoreOrder" WHERE "id"=NEW."storeOrderId" FOR UPDATE;
    IF shop."orderId"<>context."orderId" OR shop."status"::text IN ('PENDING_PAYMENT','CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED')
      OR NOT EXISTS (SELECT 1 FROM "StoreFulfillmentConnection" connection WHERE connection."id"=NEW."connectionId"
        AND connection."storeId"=shop."storeId" AND connection."provider"::text='PRINTIFY'
        AND connection."status"::text='ACTIVE' AND connection."externalShopId"=NEW."providerAccount")
      OR NOT EXISTS (SELECT 1 FROM "EconomicCapture" capture JOIN "EconomicOutbox" event ON event."contextId"=context."id"
        AND event."eventType"='capture.verified.v1' AND event."payload"->>'operationId'=capture."operationId"
        JOIN "EconomicConsumerReceipt" receipt ON receipt."eventId"=event."id" AND receipt."consumer"='lifecycle.v1'
        WHERE capture."contextId"=context."id") THEN RAISE EXCEPTION 'POD requires original shop/capture/connection proof'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicExternalEffect_guard" BEFORE INSERT OR UPDATE OR DELETE ON "EconomicExternalEffect"
  FOR EACH ROW EXECUTE FUNCTION economic_external_effect_guard();
CREATE FUNCTION economic_notification_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "EconomicConsumerReceipt" WHERE "eventId"=NEW."eventId" AND "consumer"='lifecycle.v1')
    OR NOT EXISTS (SELECT 1 FROM "Notification" WHERE "id"=NEW."notificationId" AND "userId"=NEW."recipientId"
      AND "data"->>'eventId'=NEW."eventId" AND "data"->>'version'='economic-v1') THEN
    RAISE EXCEPTION 'Notification receipt requires atomic original notification/lifecycle proof';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicNotificationReceipt_insert" BEFORE INSERT ON "EconomicNotificationReceipt"
  FOR EACH ROW EXECUTE FUNCTION economic_notification_receipt_guard();
CREATE FUNCTION economic_notification_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Notification evidence is immutable'; END; $$;
CREATE TRIGGER "EconomicNotificationReceipt_immutable" BEFORE UPDATE OR DELETE ON "EconomicNotificationReceipt"
  FOR EACH ROW EXECUTE FUNCTION economic_notification_receipt_immutable();

-- Independent safeguard: the earlier pre-handoff shipping rule must include
-- versioned POD intents, not only legacy attempts. Share the context lock with
-- intent creation so cancellation/refund cannot race a prepared provider POST.
CREATE FUNCTION economic_shipping_external_handoff_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE context_id TEXT;
BEGIN
  SELECT "contextId" INTO STRICT context_id FROM "EconomicCapture" WHERE "id"=NEW."captureId";
  PERFORM 1 FROM "EconomicOrderContext" WHERE "id"=context_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."plan"->'parts') part
    JOIN "EconomicCaptureAllocation" original ON original."captureId"=NEW."captureId" AND original."partKey"=part->>'partKey'
    JOIN "EconomicExternalEffect" effect ON effect."contextId"=context_id
      AND effect."storeOrderId"=part->>'storeOrderId' AND effect."kind"='POD_PRINTIFY'
    WHERE original."kind"='SHIPPING') THEN
    RAISE EXCEPTION 'Original shipping cannot refund a prepared or ambiguous POD handoff';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicRefundRequest_external_handoff" BEFORE INSERT ON "EconomicRefundRequest"
  FOR EACH ROW EXECUTE FUNCTION economic_shipping_external_handoff_guard();
