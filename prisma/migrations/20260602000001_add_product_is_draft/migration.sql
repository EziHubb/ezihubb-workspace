-- CreateEnum: ProductStatus replaces the isDraft boolean with a scalable status field
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- AlterTable: add status column (default ACTIVE for all existing records)
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: existing inactive products → INACTIVE
UPDATE "Product" SET "status" = 'INACTIVE' WHERE "isActive" = false AND "deletedAt" IS NULL;
-- Existing archived (soft-deleted) products → ARCHIVED
UPDATE "Product" SET "status" = 'ARCHIVED' WHERE "deletedAt" IS NOT NULL;
-- Active products remain ACTIVE (the default)
