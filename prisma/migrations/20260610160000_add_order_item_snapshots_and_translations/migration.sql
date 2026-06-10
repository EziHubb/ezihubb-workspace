-- ── FEAT-01: OrderItem snapshot fields ──────────────────────────────────────

-- Make productId nullable (for deleted products)
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- Drop old FK and recreate with ON DELETE SET NULL
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add snapshot fields
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productSlug"      TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productImageUrl"  TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variantSnapshot"  JSONB;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sku"              TEXT;

-- ── FEAT-02: Review helpfulCount ─────────────────────────────────────────────

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER NOT NULL DEFAULT 0;

-- ── FEAT-03: Translation entity ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Translation" (
  "id"              TEXT        NOT NULL,
  "entityType"      TEXT        NOT NULL,
  "entityId"        TEXT        NOT NULL,
  "locale"          TEXT        NOT NULL,
  "field"           TEXT        NOT NULL,
  "value"           TEXT        NOT NULL,
  "isAutoTranslated" BOOLEAN    NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Translation_entityType_entityId_locale_field_key"
  ON "Translation"("entityType", "entityId", "locale", "field");

CREATE INDEX IF NOT EXISTS "Translation_entityType_entityId_locale_idx"
  ON "Translation"("entityType", "entityId", "locale");

CREATE INDEX IF NOT EXISTS "Translation_locale_idx"
  ON "Translation"("locale");
