-- Prospective response receipts; no historical orders are rewritten/backfilled.
-- Intentionally no order FK: deletion of a non-financial test order leaves a
-- minimal tombstone instead of freeing a request identity for duplicate checkout.
CREATE TABLE "CheckoutRequest" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12),
  "identityHash" VARCHAR(64) NOT NULL,
  "scopeHash" VARCHAR(64) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "cartId" TEXT NOT NULL,
  "cartFingerprint" VARCHAR(64) NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "paymentRequired" BOOLEAN NOT NULL,
  "initialStatus" "OrderStatus" NOT NULL,
  "totalMinor" BIGINT NOT NULL CHECK ("totalMinor" BETWEEN 0 AND 9999999999),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("identityHash" ~ '^[0-9a-f]{64}$' AND "scopeHash" ~ '^[0-9a-f]{64}$'
    AND "payloadHash" ~ '^[0-9a-f]{64}$' AND "cartFingerprint" ~ '^[0-9a-f]{64}$'),
  CHECK ("initialStatus" = CASE WHEN "paymentRequired" THEN 'PENDING_PAYMENT'::"OrderStatus" ELSE 'CONFIRMED'::"OrderStatus" END)
);
CREATE UNIQUE INDEX "CheckoutRequest_identityHash_key" ON "CheckoutRequest" ("identityHash");
CREATE UNIQUE INDEX "CheckoutRequest_orderId_key" ON "CheckoutRequest" ("orderId");
CREATE INDEX "CheckoutRequest_cartId_cartFingerprint_idx" ON "CheckoutRequest" ("cartId", "cartFingerprint");
CREATE FUNCTION checkout_request_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Checkout request receipts are immutable'; END; $$;
CREATE TRIGGER checkout_request_immutable BEFORE UPDATE OR DELETE ON "CheckoutRequest"
  FOR EACH ROW EXECUTE FUNCTION checkout_request_immutable();
CREATE FUNCTION checkout_request_original_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "Order"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT o FROM "Order" WHERE "id"=NEW."orderId";
  IF NEW."orderNumber" IS DISTINCT FROM o."orderNumber" OR NEW."initialStatus"::text IS DISTINCT FROM o."status"::text
    OR NEW."totalMinor"::numeric IS DISTINCT FROM o."total"*100
    OR NEW."paymentRequired" IS DISTINCT FROM (EXISTS(SELECT 1 FROM "EconomicOrderContext" WHERE "orderId"=o."id")) THEN
    RAISE EXCEPTION 'Checkout response does not match the original order';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER checkout_request_original_guard BEFORE INSERT ON "CheckoutRequest"
  FOR EACH ROW EXECUTE FUNCTION checkout_request_original_guard();
