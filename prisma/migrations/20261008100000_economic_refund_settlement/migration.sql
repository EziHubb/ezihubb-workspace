-- Prospective only; no history backfill, provider operation or activation.
ALTER TYPE "EconomicJournalAccount" ADD VALUE 'PLATFORM_ROUNDING';
ALTER TABLE "EconomicBalanceLot" ADD COLUMN "reversedMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "debtRecoveredMinor" BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT "EconomicBalanceLot_reversal_bounds" CHECK (
    "reversedMinor" BETWEEN 0 AND "amountMinor" AND "debtRecoveredMinor" >= 0 AND
    "paidMinor"::numeric + "reservedMinor"::numeric + "debtRecoveredMinor"::numeric <= "amountMinor"::numeric AND
    "reservedMinor"::numeric <= greatest(0, "amountMinor"::numeric - "paidMinor"::numeric - "reversedMinor"::numeric - "debtRecoveredMinor"::numeric));

CREATE TABLE "EconomicRefund" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12),
  "requestId" TEXT NOT NULL UNIQUE REFERENCES "EconomicRefundRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "providerReference" VARCHAR(150) NOT NULL CHECK (length(trim("providerReference")) > 0),
  "evidenceHash" VARCHAR(64) NOT NULL CHECK ("evidenceHash" ~ '^[a-f0-9]{64}$'),
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0), "verifiedBy" TEXT NOT NULL CHECK (length(trim("verifiedBy")) > 0),
  "verifiedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EconomicRefundJournalEntry" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "refundId" TEXT NOT NULL REFERENCES "EconomicRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "entryKey" VARCHAR(220) NOT NULL, "account" "EconomicJournalAccount" NOT NULL, "beneficiaryId" TEXT,
  "currency" VARCHAR(3) NOT NULL, "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" <> 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("refundId", "entryKey")
);
CREATE INDEX "EconomicRefundJournalEntry_account_beneficiary_currency_idx" ON "EconomicRefundJournalEntry"("account", "beneficiaryId", "currency");
CREATE TABLE "EconomicRefundLotReversal" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "refundId" TEXT NOT NULL REFERENCES "EconomicRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lotId" TEXT NOT NULL REFERENCES "EconomicBalanceLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0), "availableDebitMinor" BIGINT NOT NULL CHECK ("availableDebitMinor" >= 0),
  "debtMinor" BIGINT NOT NULL CHECK ("debtMinor" >= 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("refundId", "lotId"), CHECK ("availableDebitMinor"::numeric + "debtMinor"::numeric = "amountMinor"::numeric)
);
CREATE INDEX "EconomicRefundLotReversal_lotId_idx" ON "EconomicRefundLotReversal"("lotId");
CREATE TABLE "EconomicDebtRecovery" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12), "lotId" TEXT NOT NULL REFERENCES "EconomicBalanceLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0), "recoveredBy" TEXT NOT NULL CHECK (length(trim("recoveredBy")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EconomicDebtRecovery_lotId_createdAt_idx" ON "EconomicDebtRecovery"("lotId", "createdAt");
CREATE TRIGGER "EconomicRefund_immutable" BEFORE UPDATE OR DELETE ON "EconomicRefund" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicRefundJournalEntry_immutable" BEFORE UPDATE OR DELETE ON "EconomicRefundJournalEntry" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicRefundLotReversal_immutable" BEFORE UPDATE OR DELETE ON "EconomicRefundLotReversal" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicDebtRecovery_immutable" BEFORE UPDATE OR DELETE ON "EconomicDebtRecovery" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

CREATE FUNCTION economic_refund_settlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "EconomicRefundRequest"%ROWTYPE; o "EconomicOperation"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM "EconomicRefundRequest" WHERE "id"=NEW."requestId";
  PERFORM "id" FROM "EconomicCapture" WHERE "id"=r."captureId" FOR UPDATE;
  SELECT * INTO STRICT o FROM "EconomicOperation" WHERE "id"=r."operationId";
  IF o."kind" <> 'REFUND' OR o."state" <> 'SUCCEEDED' OR o."providerReference" IS DISTINCT FROM NEW."providerReference"
    OR o."amountMinor" <> NEW."amountMinor" OR o."completedAt" IS DISTINCT FROM NEW."verifiedAt"
    OR NEW."amountMinor"::numeric IS DISTINCT FROM (r."plan"->>'customerMinor')::numeric THEN
    RAISE EXCEPTION 'Refund requires matching completed provider evidence';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicRefund_evidence" BEFORE INSERT ON "EconomicRefund" FOR EACH ROW EXECUTE FUNCTION economic_refund_settlement_guard();

-- BEFORE guards compare against counters before this new debit. Caller inserts
-- audit first, then adjusts counters within the same transaction.
CREATE FUNCTION economic_refund_debit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l "EconomicBalanceLot"%ROWTYPE; a "EconomicBalanceAccount"%ROWTYPE; r "EconomicRefundRequest"%ROWTYPE;
  expected NUMERIC; prior_debt NUMERIC; next_debt NUMERIC;
BEGIN
  SELECT * INTO STRICT l FROM "EconomicBalanceLot" WHERE "id"=NEW."lotId";
  SELECT * INTO STRICT a FROM "EconomicBalanceAccount" WHERE "id"=l."accountId" FOR UPDATE;
  IF TG_TABLE_NAME='EconomicDebtRecovery' THEN
    IF NEW."amountMinor" > a."debtMinor" OR NEW."amountMinor"::numeric > greatest(0,l."amountMinor"::numeric-l."paidMinor"::numeric-l."reservedMinor"::numeric-l."reversedMinor"::numeric-l."debtRecoveredMinor"::numeric)
      OR a."holdReason" IS NOT NULL OR l."holdReason" IS NOT NULL THEN RAISE EXCEPTION 'Debt recovery exceeds eligible funds'; END IF;
    IF EXISTS (SELECT 1 FROM "EconomicCapture" c JOIN "EconomicOrderContext" ctx ON ctx."id"=c."contextId" JOIN "Order" o ON o."id"=ctx."orderId"
      WHERE c."id"=l."captureId" AND (o."adminArchivedAt" IS NOT NULL OR o."status"::text IN ('PENDING_PAYMENT','CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED')
        OR NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId"=o."id" AND p."status"::text='PAID')
        OR EXISTS (SELECT 1 FROM "EconomicOperation" op WHERE op."contextId"=ctx."id" AND op."kind"='REFUND' AND op."state" NOT IN ('FAILED','SUCCEEDED'))
        OR EXISTS (SELECT 1 FROM "StoreOrder" s WHERE s."orderId"=o."id" AND (a."kind"='AFFILIATE' OR s."storeId"=a."beneficiaryId") AND s."status"::text IN ('CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'))
        OR (a."kind"='SELLER' AND (l."eligibleAt" IS NULL OR l."eligibleAt">CURRENT_TIMESTAMP))
        OR (a."kind"='AFFILIATE' AND (ctx."quote"->'affiliate'->>'id' IS DISTINCT FROM a."beneficiaryId"
          OR NOT EXISTS (SELECT 1 FROM "StoreOrder" s WHERE s."orderId"=o."id")
          OR EXISTS (SELECT 1 FROM "StoreOrder" s WHERE s."orderId"=o."id" AND (s."status"::text NOT IN ('DELIVERED','COMPLETED') OR s."deliveredAt" IS NULL))
          OR (SELECT max(s."deliveredAt") FROM "StoreOrder" s WHERE s."orderId"=o."id") + (ctx."quote"->'affiliate'->>'lockDays')::integer * interval '1 day' > CURRENT_TIMESTAMP)))) THEN
      RAISE EXCEPTION 'Debt recovery requires eligible original funds';
    END IF;
    RETURN NEW;
  END IF;
  SELECT req.* INTO STRICT r FROM "EconomicRefund" f JOIN "EconomicRefundRequest" req ON req."id"=f."requestId" WHERE f."id"=NEW."refundId";
  IF l."captureId" <> r."captureId" OR l."reservedMinor" <> 0 THEN RAISE EXCEPTION 'Foreign/reserved refund lot'; END IF;
  IF a."kind"='SELLER' THEN
    SELECT (p->>'sellerNetMinor')::numeric INTO expected FROM jsonb_array_elements(r."plan"->'parts') p WHERE p->>'partKey'=l."sourceKey" AND p->>'storeId'=a."beneficiaryId";
  ELSE
    IF l."sourceKey" <> 'affiliate-pending' THEN RAISE EXCEPTION 'Foreign affiliate reversal'; END IF;
    expected := (r."plan"->>'affiliateMinor')::numeric;
  END IF;
  prior_debt := greatest(0,l."paidMinor"::numeric+l."debtRecoveredMinor"::numeric+l."reversedMinor"::numeric-l."amountMinor"::numeric);
  next_debt := greatest(0,l."paidMinor"::numeric+l."debtRecoveredMinor"::numeric+l."reversedMinor"::numeric+NEW."amountMinor"::numeric-l."amountMinor"::numeric);
  IF expected IS DISTINCT FROM NEW."amountMinor"::numeric OR l."reversedMinor"::numeric+NEW."amountMinor"::numeric > l."amountMinor"::numeric
    OR NEW."debtMinor"::numeric <> next_debt-prior_debt THEN RAISE EXCEPTION 'Refund debit differs from original liability'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicRefundLotReversal_debit" BEFORE INSERT ON "EconomicRefundLotReversal" FOR EACH ROW EXECUTE FUNCTION economic_refund_debit_guard();
CREATE TRIGGER "EconomicDebtRecovery_debit" BEFORE INSERT ON "EconomicDebtRecovery" FOR EACH ROW EXECUTE FUNCTION economic_refund_debit_guard();

CREATE FUNCTION economic_refund_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund_id TEXT; f "EconomicRefund"%ROWTYPE; r "EconomicRefundRequest"%ROWTYPE; c "EconomicCapture"%ROWTYPE;
  actual JSONB; expected JSONB; required_count INTEGER;
BEGIN
  IF TG_TABLE_NAME='EconomicRefund' THEN refund_id:=NEW."id"; ELSE refund_id:=NEW."refundId"; END IF;
  SELECT * INTO STRICT f FROM "EconomicRefund" WHERE "id"=refund_id;
  SELECT * INTO STRICT r FROM "EconomicRefundRequest" WHERE "id"=f."requestId";
  SELECT * INTO STRICT c FROM "EconomicCapture" WHERE "id"=r."captureId";
  SELECT jsonb_agg(jsonb_build_object('entryKey',j."entryKey",'account',j."account"::text,'beneficiaryId',j."beneficiaryId",'currency',j."currency",'amountMinor',j."amountMinor"::text) ORDER BY j."entryKey" COLLATE "C")
    INTO actual FROM "EconomicRefundJournalEntry" j WHERE j."refundId"=refund_id;
  SELECT jsonb_agg(p ORDER BY p->>'entryKey' COLLATE "C") INTO expected FROM jsonb_array_elements(r."plannedJournal") p;
  IF actual IS DISTINCT FROM expected OR EXISTS (SELECT 1 FROM "EconomicRefundJournalEntry" WHERE "refundId"=refund_id AND "currency"<>c."currency")
    OR COALESCE((SELECT sum("amountMinor") FROM "EconomicRefundJournalEntry" WHERE "refundId"=refund_id),0) <> 0 THEN RAISE EXCEPTION 'Completed refund journal mismatch'; END IF;
  SELECT count(*) INTO required_count FROM jsonb_array_elements(r."plan"->'parts') p WHERE (p->>'sellerNetMinor')::numeric>0;
  IF (r."plan"->>'affiliateMinor')::numeric>0 THEN required_count:=required_count+1; END IF;
  IF (SELECT count(*) FROM "EconomicRefundLotReversal" WHERE "refundId"=refund_id) <> required_count THEN RAISE EXCEPTION 'Incomplete refund liability reversal'; END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "EconomicRefund_conservation" AFTER INSERT ON "EconomicRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_refund_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicRefundJournalEntry_conservation" AFTER INSERT ON "EconomicRefundJournalEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_refund_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicRefundLotReversal_conservation" AFTER INSERT ON "EconomicRefundLotReversal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_refund_conservation_guard();

CREATE FUNCTION economic_debt_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id TEXT; l "EconomicBalanceLot"%ROWTYPE; a "EconomicBalanceAccount"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='EconomicBalanceAccount' THEN account_id:=NEW."id";
  ELSIF TG_TABLE_NAME='EconomicBalanceLot' THEN account_id:=NEW."accountId";
  ELSE SELECT "accountId" INTO STRICT account_id FROM "EconomicBalanceLot" WHERE "id"=NEW."lotId"; END IF;
  SELECT * INTO STRICT a FROM "EconomicBalanceAccount" WHERE "id"=account_id;
  IF a."debtMinor"::numeric <> COALESCE((SELECT sum(x."debtMinor") FROM "EconomicRefundLotReversal" x JOIN "EconomicBalanceLot" b ON b."id"=x."lotId" WHERE b."accountId"=account_id),0)
    - COALESCE((SELECT sum(x."amountMinor") FROM "EconomicDebtRecovery" x JOIN "EconomicBalanceLot" b ON b."id"=x."lotId" WHERE b."accountId"=account_id),0) THEN RAISE EXCEPTION 'Debt counters do not conserve'; END IF;
  FOR l IN SELECT * FROM "EconomicBalanceLot" WHERE "accountId"=account_id LOOP
    IF l."reversedMinor"::numeric <> COALESCE((SELECT sum("amountMinor") FROM "EconomicRefundLotReversal" WHERE "lotId"=l."id"),0)
      OR l."debtRecoveredMinor"::numeric <> COALESCE((SELECT sum("amountMinor") FROM "EconomicDebtRecovery" WHERE "lotId"=l."id"),0)
      OR COALESCE((SELECT sum("debtMinor") FROM "EconomicRefundLotReversal" WHERE "lotId"=l."id"),0)
        <> greatest(0,l."paidMinor"::numeric+l."debtRecoveredMinor"::numeric+l."reversedMinor"::numeric-l."amountMinor"::numeric) THEN RAISE EXCEPTION 'Refund/recovery lot counters do not conserve'; END IF;
  END LOOP;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "EconomicBalanceAccount_debt" AFTER INSERT OR UPDATE ON "EconomicBalanceAccount" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_debt_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicBalanceLot_debt" AFTER INSERT OR UPDATE ON "EconomicBalanceLot" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_debt_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicRefundLotReversal_debt" AFTER INSERT ON "EconomicRefundLotReversal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_debt_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicDebtRecovery_debt" AFTER INSERT ON "EconomicDebtRecovery" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_debt_conservation_guard();

-- A terminal state alone cannot release a refund hold or serve as history.
CREATE FUNCTION economic_refund_operation_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."kind"='REFUND' AND NEW."state"='SUCCEEDED' AND NOT EXISTS (
    SELECT 1 FROM "EconomicRefundRequest" r JOIN "EconomicRefund" f ON f."requestId"=r."id"
    WHERE r."operationId"=NEW."id" AND f."providerReference"=NEW."providerReference" AND f."amountMinor"=NEW."amountMinor"
  ) THEN RAISE EXCEPTION 'Successful refund requires immutable settlement'; END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "EconomicOperation_refund_proof" AFTER INSERT OR UPDATE ON "EconomicOperation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_refund_operation_proof_guard();

CREATE FUNCTION economic_refund_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."kind"='REFUND' AND OLD."providerReference" IS NOT NULL AND NEW."providerReference" IS DISTINCT FROM OLD."providerReference" THEN
    RAISE EXCEPTION 'Refund provider lookup identity immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicOperation_refund_reference" BEFORE UPDATE ON "EconomicOperation" FOR EACH ROW EXECUTE FUNCTION economic_refund_reference_guard();
