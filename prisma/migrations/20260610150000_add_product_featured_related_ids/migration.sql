-- AlterTable: add manually pinned related product IDs to Product
ALTER TABLE "Product" ADD COLUMN "featuredRelatedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
