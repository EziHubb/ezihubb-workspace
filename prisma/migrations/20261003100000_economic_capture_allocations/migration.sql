-- Prospective expand only. No producer activation, ledger backfill or legacy reclassification.
CREATE TYPE "EconomicJournalAccount" AS ENUM ('CUSTOMER_FUNDS', 'PLATFORM_PROMOTION', 'SELLER_PAYABLE', 'PLATFORM_FEES', 'TAX_PAYABLE', 'PLATFORM_AFFILIATE_COST', 'AFFILIATE_PENDING');
CREATE TABLE "EconomicCapture" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "contextId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "provider" "EconomicProvider" NOT NULL,
  "providerAccount" VARCHAR(100) NOT NULL,
  "provenance" "EconomicProvenance" NOT NULL,
  "providerReference" VARCHAR(150) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "quoteHash" VARCHAR(64) NOT NULL,
  "evidenceHash" VARCHAR(64) NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicCapture_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicCapture_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "EconomicCapture_hash_check" CHECK ("quoteHash" ~ '^[a-f0-9]{64}$' AND "evidenceHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "EconomicCapture_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "EconomicOrderContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EconomicCapture_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "EconomicOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicCapture_contextId_key" ON "EconomicCapture"("contextId");
CREATE UNIQUE INDEX "EconomicCapture_operationId_key" ON "EconomicCapture"("operationId");
CREATE UNIQUE INDEX "EconomicCapture_provider_identity_key" ON "EconomicCapture"("provider", "providerAccount", "provenance", "providerReference");

CREATE TABLE "EconomicCaptureAllocation" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "captureId" TEXT NOT NULL,
  "partKey" VARCHAR(180) NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "storeId" TEXT NOT NULL,
  "storeOrderId" TEXT NOT NULL,
  "lineId" TEXT,
  "quantity" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "customerMinor" BIGINT NOT NULL,
  "platformFundingMinor" BIGINT NOT NULL,
  "sellerGrossMinor" BIGINT NOT NULL,
  "sellerFeeMinor" BIGINT NOT NULL,
  "sellerNetMinor" BIGINT NOT NULL,
  "fees" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicCaptureAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicCaptureAllocation_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "EconomicCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EconomicCaptureAllocation_money_check" CHECK (
    "quantity" > 0 AND "currency" ~ '^[A-Z]{3}$' AND "customerMinor" >= 0 AND "platformFundingMinor" >= 0 AND "sellerFeeMinor" >= 0 AND "sellerNetMinor" >= 0 AND
    "customerMinor"::numeric + "platformFundingMinor"::numeric = "sellerGrossMinor"::numeric AND
    "sellerNetMinor"::numeric + "sellerFeeMinor"::numeric = "sellerGrossMinor"::numeric
  ),
  CONSTRAINT "EconomicCaptureAllocation_kind_check" CHECK (
    ("kind" = 'ITEM' AND "lineId" IS NOT NULL) OR
    ("kind" IN ('SHIPPING', 'GIFT_WRAP') AND "lineId" IS NULL AND "quantity" = 1)
  )
);
CREATE UNIQUE INDEX "EconomicCaptureAllocation_captureId_partKey_key" ON "EconomicCaptureAllocation"("captureId", "partKey");
CREATE INDEX "EconomicCaptureAllocation_storeId_currency_idx" ON "EconomicCaptureAllocation"("storeId", "currency");
CREATE INDEX "EconomicCaptureAllocation_storeOrderId_idx" ON "EconomicCaptureAllocation"("storeOrderId");

CREATE TRIGGER "EconomicCapture_immutable" BEFORE UPDATE OR DELETE ON "EconomicCapture"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE TRIGGER "EconomicCaptureAllocation_immutable" BEFORE UPDATE OR DELETE ON "EconomicCaptureAllocation"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

CREATE TABLE "EconomicJournalEntry" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "captureId" TEXT NOT NULL,
  "entryKey" VARCHAR(220) NOT NULL,
  "account" "EconomicJournalAccount" NOT NULL,
  "beneficiaryId" TEXT,
  "currency" VARCHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EconomicJournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EconomicJournalEntry_amount_check" CHECK ("amountMinor" <> 0 AND "currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "EconomicJournalEntry_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "EconomicCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EconomicJournalEntry_captureId_entryKey_key" ON "EconomicJournalEntry"("captureId", "entryKey");
CREATE INDEX "EconomicJournalEntry_account_beneficiaryId_currency_idx" ON "EconomicJournalEntry"("account", "beneficiaryId", "currency");
CREATE TRIGGER "EconomicJournalEntry_immutable" BEFORE UPDATE OR DELETE ON "EconomicJournalEntry"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

CREATE FUNCTION economic_capture_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  operation "EconomicOperation"%ROWTYPE;
  context "EconomicOrderContext"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT operation FROM "EconomicOperation" WHERE "id" = NEW."operationId";
  SELECT * INTO STRICT context FROM "EconomicOrderContext" WHERE "id" = NEW."contextId";
  IF operation."contextId" <> context."id" OR operation."kind" <> 'CAPTURE' OR operation."state" <> 'SUCCEEDED'
    OR ROW(NEW."provider", NEW."providerAccount", NEW."provenance", NEW."providerReference", NEW."currency", NEW."amountMinor")
      IS DISTINCT FROM ROW(operation."provider", operation."providerAccount", operation."provenance", operation."providerReference", operation."currency", operation."amountMinor")
    OR NEW."quoteHash" <> context."quoteHash" OR NEW."amountMinor"::numeric IS DISTINCT FROM (context."quote"->>'customerTotalMinor')::numeric THEN
    RAISE EXCEPTION 'Capture identity does not match its successful operation and frozen quote';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EconomicCapture_identity_guard" BEFORE INSERT ON "EconomicCapture"
  FOR EACH ROW EXECUTE FUNCTION economic_capture_identity_guard();

-- Deferred: a transaction may insert the capture before its complete journal.
CREATE FUNCTION economic_capture_conservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  capture_id TEXT;
  captured "EconomicCapture"%ROWTYPE;
  quote JSONB;
BEGIN
  IF TG_TABLE_NAME = 'EconomicCapture' THEN capture_id := NEW."id";
  ELSE capture_id := NEW."captureId"; END IF;
  SELECT * INTO STRICT captured FROM "EconomicCapture" WHERE "id" = capture_id;
  SELECT "EconomicOrderContext"."quote" INTO STRICT quote FROM "EconomicOrderContext" WHERE "id" = captured."contextId";
  IF quote->'tax'->>'amountMinor' IS NULL
    OR NOT EXISTS (SELECT 1 FROM "EconomicCaptureAllocation" WHERE "captureId" = capture_id)
    OR (SELECT count(*) FROM "EconomicCaptureAllocation" WHERE "captureId" = capture_id) IS DISTINCT FROM jsonb_array_length(quote->'parts')::bigint
    OR COALESCE((SELECT sum("amountMinor") FROM "EconomicJournalEntry" WHERE "captureId" = capture_id), 0) <> 0
    OR COALESCE((SELECT sum("amountMinor") FROM "EconomicJournalEntry" WHERE "captureId" = capture_id AND "account" = 'CUSTOMER_FUNDS'), 0) <> captured."amountMinor"
    OR COALESCE((SELECT sum("customerMinor") FROM "EconomicCaptureAllocation" WHERE "captureId" = capture_id), 0) + (quote->'tax'->>'amountMinor')::numeric <> captured."amountMinor"
    OR EXISTS (SELECT 1 FROM "EconomicCaptureAllocation" WHERE "captureId" = capture_id AND "currency" <> captured."currency")
    OR EXISTS (SELECT 1 FROM "EconomicJournalEntry" WHERE "captureId" = capture_id AND "currency" <> captured."currency") THEN
    RAISE EXCEPTION 'Capture allocation/journal does not conserve verified funds';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "EconomicCaptureAllocation" a
    LEFT JOIN LATERAL (SELECT p FROM jsonb_array_elements(quote->'parts') p WHERE p->>'key' = a."partKey") q ON true
    WHERE a."captureId" = capture_id AND (
      q.p IS NULL OR ROW(a."kind", a."storeId", a."storeOrderId", a."lineId", a."quantity", a."customerMinor", a."platformFundingMinor", a."sellerGrossMinor", a."sellerFeeMinor", a."sellerNetMinor", a."fees")
      IS DISTINCT FROM ROW(q.p->>'kind', q.p->>'storeId', q.p->>'storeOrderId', q.p->>'lineId', (q.p->>'quantity')::integer,
        (q.p->>'customerMinor')::bigint, (q.p->>'platformFundingMinor')::bigint, (q.p->>'sellerGrossMinor')::bigint,
        (q.p->>'sellerFeeMinor')::bigint, (q.p->>'sellerNetMinor')::bigint, q.p->'fees')
    )
  ) OR EXISTS (
    SELECT 1 FROM
      (SELECT "storeId", sum("sellerNetMinor") AS amount FROM "EconomicCaptureAllocation" WHERE "captureId" = capture_id GROUP BY "storeId") a
      FULL JOIN
      (SELECT "beneficiaryId" AS "storeId", -sum("amountMinor") AS amount FROM "EconomicJournalEntry" WHERE "captureId" = capture_id AND "account" = 'SELLER_PAYABLE' GROUP BY "beneficiaryId") j USING ("storeId")
      WHERE COALESCE(a.amount, 0) <> COALESCE(j.amount, 0)
  ) THEN
    RAISE EXCEPTION 'Capture allocations or seller liabilities differ from frozen quote';
  END IF;
  -- Balance alone cannot detect moving tax into revenue, swapping an affiliate
  -- beneficiary, or adding offsetting bogus entries. Require the canonical
  -- capture journal, including zero-row omission, from the immutable quote.
  IF EXISTS (
    WITH parts AS (
      SELECT p, COALESCE((SELECT sum((f->>'amountMinor')::numeric)
        FROM jsonb_array_elements(p->'fees') f WHERE f->>'code' = 'VAT'), 0) AS vat
      FROM jsonb_array_elements(quote->'parts') p
    ), expected_raw(entry_key, account, beneficiary, amount) AS (
      SELECT 'customer-capture', 'CUSTOMER_FUNDS', NULL::text, captured."amountMinor"::numeric
      UNION ALL SELECT 'customer-tax', 'TAX_PAYABLE', NULL, -(quote->'tax'->>'amountMinor')::numeric
      UNION ALL SELECT p->>'key' || ':funding', 'PLATFORM_PROMOTION', NULL, (p->>'platformFundingMinor')::numeric FROM parts
      UNION ALL SELECT p->>'key' || ':seller-gross', 'SELLER_PAYABLE', p->>'storeId', -(p->>'sellerGrossMinor')::numeric FROM parts
      UNION ALL SELECT p->>'key' || ':seller-fee', 'SELLER_PAYABLE', p->>'storeId', (p->>'sellerFeeMinor')::numeric FROM parts
      UNION ALL SELECT p->>'key' || ':fee-tax', 'TAX_PAYABLE', NULL, -vat FROM parts
      UNION ALL SELECT p->>'key' || ':fee-revenue', 'PLATFORM_FEES', NULL, -((p->>'sellerFeeMinor')::numeric - vat) FROM parts
      UNION ALL SELECT 'affiliate-cost', 'PLATFORM_AFFILIATE_COST', NULL, COALESCE((quote->'affiliate'->>'commissionMinor')::numeric, 0)
      UNION ALL SELECT 'affiliate-pending', 'AFFILIATE_PENDING', quote->'affiliate'->>'id', -COALESCE((quote->'affiliate'->>'commissionMinor')::numeric, 0)
    )
    SELECT 1 FROM (SELECT * FROM expected_raw WHERE amount <> 0) e
    FULL JOIN (SELECT * FROM "EconomicJournalEntry" WHERE "captureId" = capture_id) j ON j."entryKey" = e.entry_key
    WHERE e.entry_key IS NULL OR j."id" IS NULL
      OR ROW(e.account, e.beneficiary, e.amount) IS DISTINCT FROM ROW(j."account"::text, j."beneficiaryId", j."amountMinor"::numeric)
  ) THEN
    RAISE EXCEPTION 'Capture journal accounts or beneficiaries differ from frozen quote';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "EconomicCapture_conservation" AFTER INSERT ON "EconomicCapture"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_capture_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicCaptureAllocation_conservation" AFTER INSERT ON "EconomicCaptureAllocation"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_capture_conservation_guard();
CREATE CONSTRAINT TRIGGER "EconomicJournalEntry_conservation" AFTER INSERT ON "EconomicJournalEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION economic_capture_conservation_guard();
