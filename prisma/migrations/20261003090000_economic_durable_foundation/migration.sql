-- Expand only, dormant. No backfill, no historical money rewrite or activation.
CREATE TYPE "EconomicProvenance" AS ENUM ('LIVE', 'TEST');
CREATE TYPE "EconomicProvider" AS ENUM ('STRIPE', 'PAYPAL');
CREATE TYPE "EconomicOperationKind" AS ENUM ('CAPTURE', 'REFUND');
CREATE TYPE "EconomicOperationState" AS ENUM ('PREPARED', 'DISPATCHED', 'NEEDS_RECONCILIATION', 'SUCCEEDED', 'FAILED');
CREATE TYPE "EconomicOutboxState" AS ENUM ('PENDING', 'CLAIMED', 'PUBLISHED', 'DEAD');
CREATE TYPE "EconomicStockTarget" AS ENUM ('PRODUCT', 'VARIANT', 'UNLIMITED');
CREATE TYPE "EconomicReservationState" AS ENUM ('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED');

CREATE TABLE "EconomicOrderContext" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "orderId" TEXT NOT NULL,
  "provenance" "EconomicProvenance" NOT NULL,
  "policyVersion" VARCHAR(40) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "minorExponent" INTEGER NOT NULL,
  "quoteHash" VARCHAR(64) NOT NULL,
  "quote" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicOrderContext_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicOrderContext_money_check" CHECK ("currency" ~ '^[A-Z]{3}$' AND "minorExponent" BETWEEN 0 AND 3),
  CONSTRAINT "EconomicOrderContext_hash_check" CHECK ("quoteHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "EconomicOrderContext_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicOrderContext_orderId_key" ON "EconomicOrderContext"("orderId");
CREATE UNIQUE INDEX "EconomicOrderContext_id_provenance_currency_key" ON "EconomicOrderContext"("id", "provenance", "currency");

CREATE TABLE "EconomicOperation" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "contextId" TEXT NOT NULL,
  "provenance" "EconomicProvenance" NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "provider" "EconomicProvider" NOT NULL,
  "providerAccount" VARCHAR(100) NOT NULL,
  "kind" "EconomicOperationKind" NOT NULL,
  "idempotencyKey" VARCHAR(100) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "state" "EconomicOperationState" NOT NULL DEFAULT 'PREPARED',
  "providerReference" VARCHAR(150),
  "dispatchToken" VARCHAR(64),
  "dispatchedAt" TIMESTAMP(3),
  "reconcileAfter" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EconomicOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicOperation_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "EconomicOperation_hash_check" CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "EconomicOperation_contextId_provenance_currency_fkey" FOREIGN KEY ("contextId", "provenance", "currency") REFERENCES "EconomicOrderContext"("id", "provenance", "currency") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicOperation_request_identity_key" ON "EconomicOperation"("provider", "providerAccount", "provenance", "kind", "idempotencyKey");
CREATE UNIQUE INDEX "EconomicOperation_provider_evidence_key" ON "EconomicOperation"("provider", "providerAccount", "provenance", "kind", "providerReference");
CREATE INDEX "EconomicOperation_state_reconcileAfter_idx" ON "EconomicOperation"("state", "reconcileAfter");
CREATE INDEX "EconomicOperation_contextId_idx" ON "EconomicOperation"("contextId");

CREATE TABLE "EconomicOutbox" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "contextId" TEXT NOT NULL,
  "eventKey" VARCHAR(150) NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL,
  "state" "EconomicOutboxState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" VARCHAR(64),
  "leaseUntil" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicOutbox_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "EconomicOutbox_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "EconomicOrderContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicOutbox_eventKey_key" ON "EconomicOutbox"("eventKey");
CREATE INDEX "EconomicOutbox_state_availableAt_leaseUntil_idx" ON "EconomicOutbox"("state", "availableAt", "leaseUntil");
CREATE INDEX "EconomicOutbox_contextId_idx" ON "EconomicOutbox"("contextId");

CREATE TABLE "EconomicConsumerReceipt" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "eventId" TEXT NOT NULL,
  "consumer" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicConsumerReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicConsumerReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EconomicOutbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicConsumerReceipt_eventId_consumer_key" ON "EconomicConsumerReceipt"("eventId", "consumer");

CREATE TABLE "EconomicInventoryReservation" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "contextId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "poolKey" VARCHAR(150) NOT NULL,
  "target" "EconomicStockTarget" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lines" JSONB NOT NULL,
  "state" "EconomicReservationState" NOT NULL DEFAULT 'HELD',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicInventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicInventoryReservation_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "EconomicInventoryReservation_target_check" CHECK (("target" = 'VARIANT') = ("variantId" IS NOT NULL)),
  CONSTRAINT "EconomicInventoryReservation_state_check" CHECK (
    ("state" <> 'CONSUMED' OR "consumedAt" IS NOT NULL) AND
    ("state" NOT IN ('RELEASED', 'EXPIRED') OR "releasedAt" IS NOT NULL)
  ),
  CONSTRAINT "EconomicInventoryReservation_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "EconomicOrderContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicInventoryReservation_contextId_poolKey_key" ON "EconomicInventoryReservation"("contextId", "poolKey");
CREATE INDEX "EconomicInventoryReservation_state_expiresAt_idx" ON "EconomicInventoryReservation"("state", "expiresAt");
CREATE INDEX "EconomicInventoryReservation_productId_idx" ON "EconomicInventoryReservation"("productId");

-- Prisma cannot express immutable snapshots. Never rewrite original evidence.
CREATE FUNCTION economic_reject_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Economic snapshot is immutable';
END;
$$;
CREATE TRIGGER "EconomicOrderContext_immutable" BEFORE UPDATE OR DELETE ON "EconomicOrderContext"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicConsumerReceipt_immutable" BEFORE UPDATE OR DELETE ON "EconomicConsumerReceipt"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicOperation_no_delete" BEFORE DELETE ON "EconomicOperation"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicOutbox_no_delete" BEFORE DELETE ON "EconomicOutbox"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicInventoryReservation_no_delete" BEFORE DELETE ON "EconomicInventoryReservation"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

CREATE FUNCTION economic_reservation_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."contextId", NEW."productId", NEW."variantId", NEW."poolKey", NEW."target", NEW."quantity", NEW."lines", NEW."expiresAt", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."contextId", OLD."productId", OLD."variantId", OLD."poolKey", OLD."target", OLD."quantity", OLD."lines", OLD."expiresAt", OLD."createdAt") THEN
    RAISE EXCEPTION 'Inventory reservation snapshot is immutable';
  END IF;
  IF OLD."state" = 'CONSUMED' THEN
    RAISE EXCEPTION 'Consumed inventory is immutable; restock requires separate return evidence';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EconomicInventoryReservation_update_guard" BEFORE UPDATE ON "EconomicInventoryReservation"
  FOR EACH ROW EXECUTE FUNCTION economic_reservation_update_guard();

CREATE FUNCTION economic_operation_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."contextId", NEW."provenance", NEW."currency", NEW."provider", NEW."providerAccount", NEW."kind", NEW."idempotencyKey", NEW."requestHash", NEW."amountMinor", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."contextId", OLD."provenance", OLD."currency", OLD."provider", OLD."providerAccount", OLD."kind", OLD."idempotencyKey", OLD."requestHash", OLD."amountMinor", OLD."createdAt") THEN
    RAISE EXCEPTION 'Economic operation identity is immutable';
  END IF;
  IF OLD."state" IN ('SUCCEEDED', 'FAILED') THEN
    RAISE EXCEPTION 'Terminal economic operation is immutable';
  END IF;
  IF OLD."state" <> 'PREPARED' AND ROW(NEW."dispatchToken", NEW."dispatchedAt", NEW."reconcileAfter")
    IS DISTINCT FROM ROW(OLD."dispatchToken", OLD."dispatchedAt", OLD."reconcileAfter") THEN
    RAISE EXCEPTION 'Economic dispatch identity is immutable';
  END IF;
  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'PREPARED' AND NEW."state" IN ('DISPATCHED', 'FAILED')) OR
    (OLD."state" = 'DISPATCHED' AND NEW."state" IN ('NEEDS_RECONCILIATION', 'SUCCEEDED', 'FAILED')) OR
    (OLD."state" = 'NEEDS_RECONCILIATION' AND NEW."state" IN ('SUCCEEDED', 'FAILED'))
  ) THEN
    RAISE EXCEPTION 'Invalid economic operation transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EconomicOperation_update_guard" BEFORE UPDATE ON "EconomicOperation"
  FOR EACH ROW EXECUTE FUNCTION economic_operation_update_guard();

ALTER TABLE "EconomicOperation" ADD CONSTRAINT "EconomicOperation_state_evidence_check" CHECK (
  ("state" NOT IN ('DISPATCHED', 'NEEDS_RECONCILIATION') OR ("dispatchToken" IS NOT NULL AND "dispatchedAt" IS NOT NULL AND "reconcileAfter" IS NOT NULL)) AND
  ("state" <> 'SUCCEEDED' OR ("providerReference" IS NOT NULL AND length(trim("providerReference")) > 0 AND "completedAt" IS NOT NULL)) AND
  ("state" <> 'FAILED' OR "completedAt" IS NOT NULL)
);

CREATE FUNCTION economic_outbox_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."contextId", NEW."eventKey", NEW."eventType", NEW."payload", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."contextId", OLD."eventKey", OLD."eventType", OLD."payload", OLD."createdAt") THEN
    RAISE EXCEPTION 'Economic event identity and payload are immutable';
  END IF;
  IF OLD."state" IN ('PUBLISHED', 'DEAD') THEN
    RAISE EXCEPTION 'Terminal outbox event requires a separate audited recovery operation';
  END IF;
  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'PENDING' AND NEW."state" = 'CLAIMED') OR
    (OLD."state" = 'CLAIMED' AND NEW."state" IN ('PENDING', 'PUBLISHED', 'DEAD'))
  ) THEN
    RAISE EXCEPTION 'Invalid economic outbox transition';
  END IF;
  IF (NEW."state" = 'CLAIMED' AND NEW."attempts" <> OLD."attempts" + 1) OR
    (NEW."state" <> 'CLAIMED' AND NEW."attempts" <> OLD."attempts") THEN
    RAISE EXCEPTION 'Invalid economic outbox attempt counter';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EconomicOutbox_update_guard" BEFORE UPDATE ON "EconomicOutbox"
  FOR EACH ROW EXECUTE FUNCTION economic_outbox_update_guard();

ALTER TABLE "EconomicOutbox" ADD CONSTRAINT "EconomicOutbox_lease_check" CHECK (
  ("state" = 'CLAIMED' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR
  ("state" <> 'CLAIMED' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)
);
ALTER TABLE "EconomicOutbox" ADD CONSTRAINT "EconomicOutbox_publication_check" CHECK (
  "state" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
);
