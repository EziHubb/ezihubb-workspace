-- Shop Home editor: "Add links to your website and social media" (About
-- section). Nullable JSONB array of { platform, url } pairs — additive only,
-- no existing data touched.

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "socialLinks" JSONB;
