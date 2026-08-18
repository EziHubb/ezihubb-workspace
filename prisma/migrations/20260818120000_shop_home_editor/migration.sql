-- Shop Home editor (Etsy: Shop Manager -> edit your storefront). All new
-- Store columns are nullable or default-empty — additive only, no existing
-- data touched. `description` already backs the "About > your story" field
-- (same column the dashboard "Share your story" checklist reads), so it is
-- not duplicated here.

-- AlterTable
ALTER TABLE "Store"
  ADD COLUMN "tagline" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "colorTheme" TEXT,
  ADD COLUMN "announcement" TEXT,
  ADD COLUMN "announcementUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "aboutHeadline" TEXT,
  ADD COLUMN "aboutVideoUrl" TEXT,
  ADD COLUMN "aboutPhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ownerBio" TEXT,
  ADD COLUMN "featuredProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "StoreFaq" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFaq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreFaq_storeId_idx" ON "StoreFaq"("storeId");

-- AddForeignKey
ALTER TABLE "StoreFaq" ADD CONSTRAINT "StoreFaq_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
