-- Adds digital/downloadable products (Etsy-style design-file listings), fully
-- additive and backward-compatible: every existing Product defaults to
-- PHYSICAL and every existing Order defaults to isDigital = false, so no
-- current row or code path changes behavior. Shipping columns become
-- nullable because a digital-only order never collects a shipping address
-- (see orders.service.ts checkout()).
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL');

ALTER TABLE "Product" ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL';

ALTER TABLE "Order" ADD COLUMN "isDigital" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ALTER COLUMN "shippingName" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingPhone" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingAddress" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingCity" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingZip" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingCountry" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingMethod" DROP NOT NULL;

-- DigitalFile: the seller's uploaded deliverable. storageKey is an obscure,
-- randomly-keyed object never surfaced in any API response — see
-- StorageService and order-downloads.controller.ts for how it's resolved
-- server-side only, at download time.
CREATE TABLE "DigitalFile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DigitalFile_productId_idx" ON "DigitalFile"("productId");

ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DigitalDownloadLog: per-download audit trail, the fallback traceability
-- mechanism for file formats that can't be in-file stamped (v1: everything
-- except raster images and SVG — see order-downloads.controller.ts).
CREATE TABLE "DigitalDownloadLog" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalDownloadLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DigitalDownloadLog_orderItemId_idx" ON "DigitalDownloadLog"("orderItemId");

ALTER TABLE "DigitalDownloadLog" ADD CONSTRAINT "DigitalDownloadLog_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
