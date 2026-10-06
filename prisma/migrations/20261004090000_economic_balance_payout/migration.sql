-- Prospective only. No backfill and no activation of legacy balances.
ALTER TYPE "EconomicOperationKind" ADD VALUE 'PAYMENT_CREATE';
CREATE TYPE "EconomicBeneficiaryKind" AS ENUM ('SELLER', 'AFFILIATE');
CREATE TYPE "EconomicPayoutState" AS ENUM ('REQUESTED', 'VERIFYING', 'PAID', 'REJECTED');
CREATE TABLE "EconomicBalanceAccount" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "kind" "EconomicBeneficiaryKind" NOT NULL,
  "beneficiaryId" TEXT NOT NULL, "currency" VARCHAR(3) NOT NULL, "provenance" "EconomicProvenance" NOT NULL,
  "minorExponent" INTEGER NOT NULL, "holdReason" VARCHAR(500), "debtMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("currency" ~ '^[A-Z]{3}$' AND "minorExponent" BETWEEN 0 AND 3 AND "debtMinor" >= 0)
);
CREATE UNIQUE INDEX "EconomicBalanceAccount_scope_key" ON "EconomicBalanceAccount"("kind", "beneficiaryId", "currency", "provenance");
CREATE TABLE "EconomicBalanceLot" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "accountId" TEXT NOT NULL REFERENCES "EconomicBalanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "captureId" TEXT NOT NULL REFERENCES "EconomicCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sourceKey" VARCHAR(180) NOT NULL, "amountMinor" BIGINT NOT NULL,
  "reservedMinor" BIGINT NOT NULL DEFAULT 0, "paidMinor" BIGINT NOT NULL DEFAULT 0,
  "eligibleAt" TIMESTAMP(3), "holdReason" VARCHAR(500), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("amountMinor" > 0 AND "reservedMinor" >= 0 AND "paidMinor" >= 0 AND "reservedMinor"::numeric + "paidMinor"::numeric <= "amountMinor"::numeric)
);
CREATE UNIQUE INDEX "EconomicBalanceLot_source_key" ON "EconomicBalanceLot"("captureId", "sourceKey");
CREATE INDEX "EconomicBalanceLot_accountId_eligibleAt_idx" ON "EconomicBalanceLot"("accountId", "eligibleAt");
CREATE TABLE "EconomicPayout" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "accountId" TEXT NOT NULL REFERENCES "EconomicBalanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idempotencyKey" VARCHAR(100) NOT NULL, "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "state" "EconomicPayoutState" NOT NULL DEFAULT 'REQUESTED', "requestedBy" TEXT NOT NULL,
  "destination" VARCHAR(150) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "processedBy" TEXT, "rejectionReason" VARCHAR(500),
  "verificationStartedAt" TIMESTAMP(3), "verificationStartedBy" TEXT,
  "transferProvider" "EconomicProvider", "transferAccount" VARCHAR(100), "transferProvenance" "EconomicProvenance",
  "transferReference" VARCHAR(150), "transferEvidenceHash" VARCHAR(64),
  CHECK (length(trim("destination")) > 0 AND length(trim("requestedBy")) > 0 AND length(trim("idempotencyKey")) > 0),
  CHECK ("state" IN ('REQUESTED', 'VERIFYING') OR ("processedAt" IS NOT NULL AND "processedBy" IS NOT NULL AND length(trim("processedBy")) > 0)),
  CHECK ("state" <> 'REJECTED' OR ("rejectionReason" IS NOT NULL AND length(trim("rejectionReason")) > 0)),
  CHECK ("state" NOT IN ('VERIFYING', 'PAID') OR ("transferProvider" IS NOT NULL AND "transferAccount" IS NOT NULL AND "transferProvenance" IS NOT NULL
    AND "transferReference" IS NOT NULL AND length(trim("transferReference")) > 0 AND length(trim("transferAccount")) > 0
    AND "verificationStartedAt" IS NOT NULL AND "verificationStartedBy" IS NOT NULL AND length(trim("verificationStartedBy")) > 0)),
  CHECK ("state" <> 'PAID' OR ("transferEvidenceHash" IS NOT NULL AND "transferEvidenceHash" ~ '^[a-f0-9]{64}$')),
  CHECK ("state" IN ('VERIFYING', 'PAID') OR ("transferProvider" IS NULL AND "transferAccount" IS NULL AND "transferProvenance" IS NULL
    AND "transferReference" IS NULL AND "transferEvidenceHash" IS NULL)),
  CHECK ("state" NOT IN ('REQUESTED', 'VERIFYING') OR ("processedAt" IS NULL AND "processedBy" IS NULL AND "rejectionReason" IS NULL))
);
CREATE UNIQUE INDEX "EconomicPayout_request_key" ON "EconomicPayout"("accountId", "idempotencyKey");
CREATE UNIQUE INDEX "EconomicPayout_transfer_key" ON "EconomicPayout"("transferProvider", "transferAccount", "transferProvenance", "transferReference");
CREATE INDEX "EconomicPayout_state_createdAt_idx" ON "EconomicPayout"("state", "createdAt");
CREATE TABLE "EconomicPayoutAllocation" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "payoutId" TEXT NOT NULL REFERENCES "EconomicPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lotId" TEXT NOT NULL REFERENCES "EconomicBalanceLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EconomicPayoutAllocation_payoutId_lotId_key" ON "EconomicPayoutAllocation"("payoutId", "lotId");
CREATE INDEX "EconomicPayoutAllocation_lotId_idx" ON "EconomicPayoutAllocation"("lotId");
CREATE TRIGGER "EconomicPayoutAllocation_immutable" BEFORE UPDATE OR DELETE ON "EconomicPayoutAllocation" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicBalanceLot_no_delete" BEFORE DELETE ON "EconomicBalanceLot" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicPayout_no_delete" BEFORE DELETE ON "EconomicPayout" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicBalanceAccount_no_delete" BEFORE DELETE ON "EconomicBalanceAccount" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

CREATE FUNCTION economic_balance_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "EconomicBalanceAccount"%ROWTYPE; c "EconomicCapture"%ROWTYPE; q JSONB; expected NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'EconomicBalanceAccount' THEN
    IF ROW(NEW."id",NEW."kind",NEW."beneficiaryId",NEW."currency",NEW."provenance",NEW."minorExponent",NEW."createdAt") IS DISTINCT FROM
       ROW(OLD."id",OLD."kind",OLD."beneficiaryId",OLD."currency",OLD."provenance",OLD."minorExponent",OLD."createdAt") THEN RAISE EXCEPTION 'Balance account identity immutable'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND ROW(NEW."id",NEW."accountId",NEW."captureId",NEW."sourceKey",NEW."amountMinor",NEW."createdAt") IS DISTINCT FROM
     ROW(OLD."id",OLD."accountId",OLD."captureId",OLD."sourceKey",OLD."amountMinor",OLD."createdAt") THEN RAISE EXCEPTION 'Balance lot identity immutable'; END IF;
  SELECT * INTO STRICT a FROM "EconomicBalanceAccount" WHERE "id" = NEW."accountId";
  SELECT * INTO STRICT c FROM "EconomicCapture" WHERE "id" = NEW."captureId";
  SELECT "quote" INTO STRICT q FROM "EconomicOrderContext" WHERE "id" = c."contextId";
  IF a."currency" <> c."currency" OR a."provenance" <> c."provenance" OR a."minorExponent" <> (q->>'minorExponent')::integer THEN RAISE EXCEPTION 'Balance currency/mode mismatch'; END IF;
  IF a."kind" = 'SELLER' THEN
    SELECT "sellerNetMinor" INTO expected FROM "EconomicCaptureAllocation" WHERE "captureId" = c."id" AND "partKey" = NEW."sourceKey" AND "storeId" = a."beneficiaryId";
  ELSE
    IF NEW."sourceKey" <> 'affiliate-pending' OR a."beneficiaryId" IS DISTINCT FROM q->'affiliate'->>'id' THEN RAISE EXCEPTION 'Foreign affiliate lot'; END IF;
    expected := (q->'affiliate'->>'commissionMinor')::numeric;
  END IF;
  IF expected IS DISTINCT FROM NEW."amountMinor"::numeric THEN RAISE EXCEPTION 'Lot differs from captured liability'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicBalanceAccount_identity" BEFORE UPDATE ON "EconomicBalanceAccount" FOR EACH ROW EXECUTE FUNCTION economic_balance_identity_guard();
CREATE TRIGGER "EconomicBalanceLot_identity" BEFORE INSERT OR UPDATE ON "EconomicBalanceLot" FOR EACH ROW EXECUTE FUNCTION economic_balance_identity_guard();
CREATE FUNCTION economic_payout_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" IN ('PAID', 'REJECTED') THEN RAISE EXCEPTION 'Terminal payout immutable'; END IF;
  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state"='REQUESTED' AND NEW."state" IN ('VERIFYING', 'REJECTED')) OR
    (OLD."state"='VERIFYING' AND NEW."state"='PAID')
  ) THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
  IF OLD."state"='VERIFYING' AND ROW(NEW."transferProvider",NEW."transferAccount",NEW."transferProvenance",NEW."transferReference",NEW."verificationStartedAt",NEW."verificationStartedBy") IS DISTINCT FROM
    ROW(OLD."transferProvider",OLD."transferAccount",OLD."transferProvenance",OLD."transferReference",OLD."verificationStartedAt",OLD."verificationStartedBy") THEN RAISE EXCEPTION 'Transfer lookup identity immutable'; END IF;
  IF ROW(NEW."id",NEW."accountId",NEW."amountMinor",NEW."idempotencyKey",NEW."requestedBy",NEW."destination",NEW."createdAt") IS DISTINCT FROM
     ROW(OLD."id",OLD."accountId",OLD."amountMinor",OLD."idempotencyKey",OLD."requestedBy",OLD."destination",OLD."createdAt") THEN RAISE EXCEPTION 'Payout identity immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicPayout_identity" BEFORE UPDATE ON "EconomicPayout" FOR EACH ROW EXECUTE FUNCTION economic_payout_identity_guard();
CREATE FUNCTION economic_payout_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payout_id TEXT; lot_id TEXT; payout_row "EconomicPayout"%ROWTYPE; l "EconomicBalanceLot"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'EconomicBalanceLot' THEN lot_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'EconomicPayout' THEN payout_id := NEW."id";
  ELSE payout_id := NEW."payoutId"; lot_id := NEW."lotId"; END IF;
  IF payout_id IS NOT NULL THEN
    SELECT * INTO STRICT payout_row FROM "EconomicPayout" WHERE "id" = payout_id;
    IF payout_row."amountMinor"::numeric <> COALESCE((SELECT sum("amountMinor") FROM "EconomicPayoutAllocation" WHERE "payoutId" = payout_id),0)
       OR EXISTS (SELECT 1 FROM "EconomicPayoutAllocation" x JOIN "EconomicBalanceLot" b ON b."id"=x."lotId" WHERE x."payoutId"=payout_id AND b."accountId"<>payout_row."accountId")
       OR (payout_row."state" IN ('VERIFYING', 'PAID') AND payout_row."transferProvenance" IS DISTINCT FROM (SELECT "provenance" FROM "EconomicBalanceAccount" WHERE "id"=payout_row."accountId")) THEN RAISE EXCEPTION 'Payout allocation mismatch'; END IF;
  END IF;
  FOR l IN SELECT * FROM "EconomicBalanceLot" b WHERE b."id" = lot_id OR b."id" IN (SELECT "lotId" FROM "EconomicPayoutAllocation" WHERE "payoutId" = payout_id) LOOP
    IF l."reservedMinor"::numeric <> COALESCE((SELECT sum(x."amountMinor") FROM "EconomicPayoutAllocation" x JOIN "EconomicPayout" p ON p."id"=x."payoutId" WHERE x."lotId"=l."id" AND p."state" IN ('REQUESTED', 'VERIFYING')),0)
      OR l."paidMinor"::numeric <> COALESCE((SELECT sum(x."amountMinor") FROM "EconomicPayoutAllocation" x JOIN "EconomicPayout" p ON p."id"=x."payoutId" WHERE x."lotId"=l."id" AND p."state"='PAID'),0) THEN RAISE EXCEPTION 'Payout lot counters do not conserve'; END IF;
  END LOOP;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "EconomicPayout_conservation" AFTER INSERT OR UPDATE ON "EconomicPayout" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_payout_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicPayoutAllocation_conservation" AFTER INSERT ON "EconomicPayoutAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_payout_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicBalanceLot_conservation" AFTER INSERT OR UPDATE ON "EconomicBalanceLot" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_payout_conservation_guard();
