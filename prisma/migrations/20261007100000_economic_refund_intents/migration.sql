-- Additive, prospective intent preparation only. No backfill or refund dispatch.
CREATE TABLE "EconomicRefundRequest" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12),
  "captureId" TEXT NOT NULL REFERENCES "EconomicCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "operationId" TEXT NOT NULL REFERENCES "EconomicOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestedBy" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "plan" JSONB NOT NULL,
  "plannedJournal" JSONB NOT NULL,
  "platformRoundingMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim("requestedBy")) > 0 AND length(trim("reason")) > 0),
  CHECK (jsonb_typeof("plan") = 'object'),
  CHECK (jsonb_typeof("plannedJournal") = 'array')
);
CREATE UNIQUE INDEX "EconomicRefundRequest_operationId_key" ON "EconomicRefundRequest"("operationId");
CREATE INDEX "EconomicRefundRequest_captureId_createdAt_idx" ON "EconomicRefundRequest"("captureId", "createdAt");
CREATE TRIGGER "EconomicRefundRequest_immutable" BEFORE UPDATE OR DELETE ON "EconomicRefundRequest"
  FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();

-- Draft journal rows have no effect on captured balances or actual spend.
CREATE FUNCTION economic_refund_planned_entry(entry_key TEXT, account_name TEXT,
  currency_code TEXT, amount NUMERIC, beneficiary TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN amount=0 THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
    'entryKey',entry_key,'account',account_name,'currency',currency_code,
    'amountMinor',amount::bigint::text,'beneficiaryId',beneficiary)) END;
$$;

CREATE FUNCTION economic_refund_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "EconomicCapture"%ROWTYPE; o "EconomicOperation"%ROWTYPE; p JSONB;
  a "EconomicCaptureAllocation"%ROWTYPE; total NUMERIC := 0; seen TEXT[] := '{}'; field TEXT; original NUMERIC;
  fee JSONB; original_fee JSONB; fee_index INTEGER; fee_total NUMERIC;
  rounding_total NUMERIC := 0; affiliate_total NUMERIC := 0; fee_tax NUMERIC;
  funding_rounding NUMERIC; beneficiary_rounding NUMERIC; fee_rounding NUMERIC; part_rounding NUMERIC;
  snapshot JSONB; commission NUMERIC; original_affiliate NUMERIC; expected_affiliate NUMERIC;
  expected_journal JSONB := '[]';
BEGIN
  SELECT * INTO STRICT c FROM "EconomicCapture" WHERE "id" = NEW."captureId" FOR UPDATE;
  SELECT * INTO STRICT o FROM "EconomicOperation" WHERE "id" = NEW."operationId";
  SELECT "quote" INTO STRICT snapshot FROM "EconomicOrderContext" WHERE "id"=c."contextId";
  IF o."kind" <> 'REFUND' OR o."state" <> 'PREPARED'
    OR ROW(o."contextId",o."provider",o."providerAccount",o."provenance",o."currency") IS DISTINCT FROM
       ROW(c."contextId",c."provider",c."providerAccount",c."provenance",c."currency")
    OR NEW."plan"->>'version' IS DISTINCT FROM 'refund-v1'
    OR NEW."plan"->>'roundingPolicy' IS DISTINCT FROM '2026-10-08.platform-rounding.v1'
    OR NEW."plan"->>'quoteHash' IS DISTINCT FROM c."quoteHash"
    OR NEW."plan"->>'currency' IS DISTINCT FROM c."currency"
    OR NEW."plan"->>'minorExponent' IS DISTINCT FROM (SELECT "minorExponent"::text FROM "EconomicOrderContext" WHERE "id"=c."contextId")
    OR jsonb_typeof(NEW."plan"->'parts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW."plan"->'customerMinor') IS DISTINCT FROM 'string'
    OR COALESCE(NEW."plan"->>'customerMinor','') !~ '^[1-9][0-9]*$'
    OR (NEW."plan"->>'customerMinor')::numeric <> o."amountMinor" THEN
    RAISE EXCEPTION 'Refund intent does not match original capture';
  END IF;
  IF (snapshot->'tax'->>'amountMinor')::numeric <> 0 THEN RAISE EXCEPTION 'Refund tax allocation is unsupported'; END IF;
  commission := COALESCE(snapshot->'affiliate'->>'commissionMinor','0')::numeric;
  expected_journal := economic_refund_planned_entry('customer-refund','CUSTOMER_FUNDS',c."currency",-o."amountMinor");
  IF jsonb_array_length(NEW."plan"->'parts') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid refund parts'; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(NEW."plan"->'parts') LOOP
    IF COALESCE(p->>'partKey','') = '' OR p->>'partKey' = ANY(seen)
      OR COALESCE(p->>'quantity','') !~ '^[1-9][0-9]*$'
      OR COALESCE(p->>'previousQuantity','') !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'Invalid refund quantities'; END IF;
    seen := array_append(seen, p->>'partKey');
    SELECT * INTO STRICT a FROM "EconomicCaptureAllocation" WHERE "captureId"=c."id" AND "partKey"=p->>'partKey';
    IF a."kind" <> 'ITEM' OR p->>'storeId' IS DISTINCT FROM a."storeId"
      OR p->>'storeOrderId' IS DISTINCT FROM a."storeOrderId" OR p->>'lineId' IS DISTINCT FROM a."lineId"
      OR (p->>'quantity')::numeric + (p->>'previousQuantity')::numeric > a."quantity"
      OR jsonb_typeof(p->'customerMinor') IS DISTINCT FROM 'string'
      OR COALESCE(p->>'customerMinor','') !~ '^(0|[1-9][0-9]*)$'
      OR (p->>'customerMinor')::numeric <> floor(a."customerMinor"::numeric * ((p->>'previousQuantity')::numeric + (p->>'quantity')::numeric) / a."quantity")
        - floor(a."customerMinor"::numeric * (p->>'previousQuantity')::numeric / a."quantity") THEN
      RAISE EXCEPTION 'Refund part exceeds original allocation';
    END IF;
    FOREACH field IN ARRAY ARRAY['platformFundingMinor','sellerGrossMinor','sellerFeeMinor','sellerNetMinor'] LOOP
      original := (to_jsonb(a)->>field)::numeric;
      IF jsonb_typeof(p->field) IS DISTINCT FROM 'string' OR COALESCE(p->>field,'') !~ '^(0|[1-9][0-9]*)$'
        OR (p->>field)::numeric <> floor(original * ((p->>'previousQuantity')::numeric + (p->>'quantity')::numeric) / a."quantity")
          - floor(original * (p->>'previousQuantity')::numeric / a."quantity") THEN
        RAISE EXCEPTION 'Refund beneficiary amount differs from original allocation';
      END IF;
    END LOOP;
    -- A conserving fee total is insufficient: preserve the original fee code,
    -- rule and cumulative allocation, including zero-valued fee components.
    IF jsonb_typeof(p->'fees') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p->'fees') <> jsonb_array_length(a."fees") THEN
      RAISE EXCEPTION 'Refund fee components differ from original allocation';
    END IF;
    fee_total := 0; fee_tax := 0;
    FOR fee_index IN 0..jsonb_array_length(a."fees") - 1 LOOP
      original_fee := a."fees"->fee_index;
      fee := p->'fees'->fee_index;
      IF fee->>'code' IS DISTINCT FROM original_fee->>'code'
        OR fee->>'ruleReference' IS DISTINCT FROM original_fee->>'ruleReference'
        OR jsonb_typeof(fee->'amountMinor') IS DISTINCT FROM 'string'
        OR COALESCE(fee->>'amountMinor','') !~ '^(0|[1-9][0-9]*)$'
        OR (fee->>'amountMinor')::numeric <> floor((original_fee->>'amountMinor')::numeric * ((p->>'previousQuantity')::numeric + (p->>'quantity')::numeric) / a."quantity")
          - floor((original_fee->>'amountMinor')::numeric * (p->>'previousQuantity')::numeric / a."quantity") THEN
        RAISE EXCEPTION 'Refund fee component differs from original allocation';
      END IF;
      fee_total := fee_total + (fee->>'amountMinor')::numeric;
      IF fee->>'code'='VAT' THEN fee_tax := fee_tax + (fee->>'amountMinor')::numeric; END IF;
    END LOOP;
    funding_rounding := (p->>'customerMinor')::numeric + (p->>'platformFundingMinor')::numeric - (p->>'sellerGrossMinor')::numeric;
    beneficiary_rounding := (p->>'sellerGrossMinor')::numeric - (p->>'sellerNetMinor')::numeric - (p->>'sellerFeeMinor')::numeric;
    fee_rounding := (p->>'sellerFeeMinor')::numeric - fee_total;
    part_rounding := funding_rounding + beneficiary_rounding + fee_rounding;
    IF abs(funding_rounding)>1 OR abs(beneficiary_rounding)>1
      OR abs(fee_rounding)>greatest(0,jsonb_array_length(a."fees")-1)
      OR jsonb_typeof(p->'rounding') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Refund difference exceeds cumulative rounding bounds';
    END IF;
    FOREACH field IN ARRAY ARRAY['fundingMinor','beneficiaryMinor','feeMinor','platformMinor'] LOOP
      original := CASE field WHEN 'fundingMinor' THEN funding_rounding WHEN 'beneficiaryMinor' THEN beneficiary_rounding
        WHEN 'feeMinor' THEN fee_rounding ELSE part_rounding END;
      IF jsonb_typeof(p->'rounding'->field) IS DISTINCT FROM 'string'
        OR COALESCE(p->'rounding'->>field,'') !~ '^(0|-?[1-9][0-9]*)$'
        OR (p->'rounding'->>field)::numeric <> original THEN
        RAISE EXCEPTION 'Refund rounding differs from original allocation';
      END IF;
    END LOOP;
    rounding_total := rounding_total + part_rounding;
    -- Original largest-remainder split, tied by immutable part ID, followed by
    -- the same cumulative quantity floors as customer/seller/fee reversals.
    WITH weights AS (
      SELECT "partKey", "sellerGrossMinor"::numeric AS weight,
        sum("sellerGrossMinor"::numeric) OVER () AS denominator
      FROM "EconomicCaptureAllocation" WHERE "captureId"=c."id" AND "kind"='ITEM'
    ), shares AS (
      SELECT "partKey", COALESCE(floor(commission*weight/nullif(denominator,0)),0) AS base,
        COALESCE(mod(commission*weight,nullif(denominator,0)),0) AS remainder FROM weights
    ), ranked AS (
      SELECT "partKey", base, row_number() OVER (ORDER BY remainder DESC,"partKey" COLLATE "C") AS rank,
        commission-sum(base) OVER () AS residual FROM shares
    ) SELECT base + CASE WHEN rank<=residual THEN 1 ELSE 0 END INTO STRICT original_affiliate
      FROM ranked WHERE "partKey"=a."partKey";
    expected_affiliate := floor(original_affiliate*((p->>'previousQuantity')::numeric+(p->>'quantity')::numeric)/a."quantity")
      - floor(original_affiliate*(p->>'previousQuantity')::numeric/a."quantity");
    IF jsonb_typeof(p->'affiliateMinor') IS DISTINCT FROM 'string'
      OR COALESCE(p->>'affiliateMinor','') !~ '^(0|[1-9][0-9]*)$'
      OR (p->>'affiliateMinor')::numeric <> expected_affiliate THEN
      RAISE EXCEPTION 'Refund affiliate amount differs from original allocation';
    END IF;
    affiliate_total := affiliate_total + expected_affiliate;
    expected_journal := expected_journal
      || economic_refund_planned_entry(a."partKey"||':funding','PLATFORM_PROMOTION',c."currency",-(p->>'platformFundingMinor')::numeric)
      || economic_refund_planned_entry(a."partKey"||':seller-net','SELLER_PAYABLE',c."currency",(p->>'sellerNetMinor')::numeric,a."storeId")
      || economic_refund_planned_entry(a."partKey"||':fee-tax','TAX_PAYABLE',c."currency",fee_tax)
      || economic_refund_planned_entry(a."partKey"||':fee-revenue','PLATFORM_FEES',c."currency",fee_total-fee_tax)
      || economic_refund_planned_entry(a."partKey"||':platform-rounding','PLATFORM_ROUNDING',c."currency",part_rounding);
    total := total + (p->>'customerMinor')::numeric;
    IF (p->>'previousQuantity')::numeric <> COALESCE((
      SELECT sum((part->>'quantity')::numeric) FROM "EconomicRefundRequest" r
      JOIN "EconomicOperation" op ON op."id"=r."operationId",
      LATERAL jsonb_array_elements(r."plan"->'parts') part
      WHERE r."captureId"=c."id" AND op."state"='SUCCEEDED' AND part->>'partKey'=a."partKey"
    ),0) THEN RAISE EXCEPTION 'Refund history changed'; END IF;
  END LOOP;
  IF jsonb_typeof(NEW."plan"->'platformRoundingMinor') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW."plan"->'affiliateMinor') IS DISTINCT FROM 'string'
    OR COALESCE(NEW."plan"->>'platformRoundingMinor','') !~ '^(0|-?[1-9][0-9]*)$'
    OR (NEW."plan"->>'platformRoundingMinor')::numeric <> rounding_total
    OR NEW."platformRoundingMinor" <> rounding_total
    OR COALESCE(NEW."plan"->>'affiliateMinor','') !~ '^(0|[1-9][0-9]*)$'
    OR (NEW."plan"->>'affiliateMinor')::numeric <> affiliate_total THEN
    RAISE EXCEPTION 'Refund rounding or affiliate total differs from original allocations';
  END IF;
  IF snapshot->'affiliate'->>'id' IS NOT NULL THEN
    expected_journal := expected_journal
      || economic_refund_planned_entry('affiliate-cost','PLATFORM_AFFILIATE_COST',c."currency",-affiliate_total)
      || economic_refund_planned_entry('affiliate-pending','AFFILIATE_PENDING',c."currency",affiliate_total,snapshot->'affiliate'->>'id');
  END IF;
  IF NEW."plannedJournal" IS DISTINCT FROM expected_journal THEN
    RAISE EXCEPTION 'Refund planned journal differs from original allocation';
  END IF;
  IF total <> o."amountMinor" OR total + COALESCE((SELECT sum(op."amountMinor"::numeric)
      FROM "EconomicRefundRequest" r JOIN "EconomicOperation" op ON op."id"=r."operationId"
      WHERE r."captureId"=c."id" AND op."state" <> 'FAILED'),0) > c."amountMinor" THEN
    RAISE EXCEPTION 'Refund exceeds captured funds';
  END IF;
  IF EXISTS (SELECT 1 FROM "EconomicOperation" op WHERE op."contextId"=c."contextId"
      AND op."kind"='REFUND' AND op."id"<>o."id" AND op."state" IN ('PREPARED','DISPATCHED','NEEDS_RECONCILIATION')) THEN
    RAISE EXCEPTION 'Resolve previous refund first';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicRefundRequest_guard" BEFORE INSERT ON "EconomicRefundRequest"
  FOR EACH ROW EXECUTE FUNCTION economic_refund_intent_guard();
