-- Prospective full-shop pre-handoff shipping refunds. No historic plans rewritten.
-- Preserve original amounts, fee components, gift-wrap approval and settlement guards.
CREATE OR REPLACE FUNCTION economic_refund_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "EconomicCapture"%ROWTYPE; o "EconomicOperation"%ROWTYPE; p JSONB;
  a "EconomicCaptureAllocation"%ROWTYPE; total NUMERIC := 0; seen TEXT[] := '{}'; field TEXT; original NUMERIC;
  fee JSONB; original_fee JSONB; fee_index INTEGER; fee_total NUMERIC;
  rounding_total NUMERIC := 0; affiliate_total NUMERIC := 0; fee_tax NUMERIC;
  funding_rounding NUMERIC; beneficiary_rounding NUMERIC; fee_rounding NUMERIC; part_rounding NUMERIC;
  snapshot JSONB; commission NUMERIC; original_affiliate NUMERIC; expected_affiliate NUMERIC;
  expected_journal JSONB := '[]'; gift_wrap BOOLEAN := false;
  shipping_ids TEXT[] := '{}'; previous_items JSONB; shop_row "StoreOrder"%ROWTYPE; item_row RECORD; refunded_units NUMERIC;
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
    IF a."kind" = 'GIFT_WRAP' THEN
      gift_wrap := true;
      IF NEW."plan"->'giftWrapApproval' IS DISTINCT FROM jsonb_build_object(
        'policy','2026-10-08.gift-wrap-explicit-approval.v1','approvedBy',NEW."requestedBy",'reason',NEW."reason") THEN
        RAISE EXCEPTION 'Gift wrap refund requires explicit matching actor/reason approval';
      END IF;
    END IF;
    IF a."kind" = 'SHIPPING' THEN
      -- Serialize against versioned transitions and external dispatch preparation.
      PERFORM "id" FROM "EconomicOrderContext" WHERE "id"=c."contextId" FOR UPDATE;
      PERFORM "id" FROM "Order" WHERE "id"=(SELECT "orderId" FROM "EconomicOrderContext" WHERE "id"=c."contextId") FOR UPDATE;
      SELECT * INTO STRICT shop_row FROM "StoreOrder" WHERE "id"=a."storeOrderId" FOR UPDATE;
      IF shop_row."orderId" IS DISTINCT FROM snapshot->>'orderId' OR shop_row."storeId" IS DISTINCT FROM a."storeId"
        OR shop_row."status"::text IS DISTINCT FROM 'CANCELLED'
        OR shop_row."shippedAt" IS NOT NULL OR shop_row."deliveredAt" IS NOT NULL
        OR shop_row."trackingNumber" IS NOT NULL OR shop_row."trackingUrl" IS NOT NULL OR shop_row."carrier" IS NOT NULL
        OR EXISTS (SELECT 1 FROM "StoreOrderFulfillment" WHERE "storeOrderId"=a."storeOrderId")
        OR EXISTS (SELECT 1 FROM "Order" WHERE "id"=shop_row."orderId" AND ("shippedAt" IS NOT NULL OR "deliveredAt" IS NOT NULL))
        OR EXISTS (SELECT 1 FROM "OrderStatusHistory" WHERE "orderId"=shop_row."orderId" AND "status"::text IN ('SHIPPED','DELIVERED','COMPLETED')) THEN
        RAISE EXCEPTION 'Shipping refund requires cancelled shop with no handoff or POD attempt';
      END IF;
      shipping_ids := array_append(shipping_ids,a."storeOrderId");
      FOR item_row IN SELECT * FROM "EconomicCaptureAllocation" WHERE "captureId"=c."id"
        AND "storeOrderId"=a."storeOrderId" AND "kind"='ITEM' LOOP
        SELECT COALESCE(sum((part->>'quantity')::numeric),0) INTO refunded_units
          FROM "EconomicRefundRequest" r JOIN "EconomicOperation" op ON op."id"=r."operationId"
          JOIN "EconomicRefund" proof ON proof."requestId"=r."id",
          LATERAL jsonb_array_elements(r."plan"->'parts') part
          WHERE r."captureId"=c."id" AND op."state"='SUCCEEDED' AND part->>'partKey'=item_row."partKey";
        IF refunded_units + COALESCE((SELECT sum((part->>'quantity')::numeric)
          FROM jsonb_array_elements(NEW."plan"->'parts') part WHERE part->>'partKey'=item_row."partKey"),0) <> item_row."quantity" THEN
          RAISE EXCEPTION 'Shipping refund requires every original shop item to be refunded';
        END IF;
      END LOOP;
    END IF;
    IF a."kind" NOT IN ('ITEM','GIFT_WRAP','SHIPPING') OR p->>'storeId' IS DISTINCT FROM a."storeId"
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
    original_affiliate := 0;
    IF a."kind" = 'ITEM' THEN
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
    END IF;
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
  IF cardinality(shipping_ids)>0 THEN
    SELECT array_agg(id ORDER BY id COLLATE "C") INTO shipping_ids FROM unnest(shipping_ids) id;
    SELECT jsonb_object_agg(original_part."partKey",COALESCE((
      SELECT sum((part->>'quantity')::numeric) FROM "EconomicRefundRequest" r
      JOIN "EconomicOperation" op ON op."id"=r."operationId" JOIN "EconomicRefund" proof ON proof."requestId"=r."id",
      LATERAL jsonb_array_elements(r."plan"->'parts') part
      WHERE r."captureId"=c."id" AND op."state"='SUCCEEDED' AND part->>'partKey'=original_part."partKey"
    ),0)) INTO previous_items FROM "EconomicCaptureAllocation" original_part
      WHERE original_part."captureId"=c."id" AND original_part."kind"='ITEM' AND original_part."storeOrderId"=ANY(shipping_ids);
    IF NEW."plan"->'shippingEligibility' IS DISTINCT FROM jsonb_build_object(
      'policy','2026-10-08.full-shop-pre-handoff.v1','storeOrderIds',to_jsonb(shipping_ids),
      'previousItemQuantities',previous_items) THEN
      RAISE EXCEPTION 'Shipping eligibility differs from original settled history';
    END IF;
  ELSIF NEW."plan" ? 'shippingEligibility' THEN
    RAISE EXCEPTION 'Shipping eligibility has no selected original allocation';
  END IF;
  IF NEW."plan" ? 'giftWrapApproval' AND NOT gift_wrap THEN
    RAISE EXCEPTION 'Gift wrap approval has no selected original allocation';
  END IF;
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
