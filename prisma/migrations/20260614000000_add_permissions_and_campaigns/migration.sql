-- AddColumn: User.permissions (Json, nullable)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;

-- CreateEnum: CampaignSeason
DO $$ BEGIN
  CREATE TYPE "CampaignSeason" AS ENUM ('spring', 'summer', 'autumn', 'winter');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Campaign
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "season"       "CampaignSeason" NOT NULL,
    "isActive"     BOOLEAN NOT NULL DEFAULT false,
    "bannerText"   TEXT NOT NULL DEFAULT '',
    "ctaLabel"     TEXT NOT NULL DEFAULT 'Shop now',
    "ctaHref"      TEXT NOT NULL DEFAULT '/products',
    "countdownEnd" TIMESTAMP(3),
    "gradient"     TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "accentColor"  TEXT NOT NULL DEFAULT '#000000',
    "bgColor"      TEXT NOT NULL DEFAULT '#ffffff',
    "startDate"    TIMESTAMP(3),
    "endDate"      TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_season_key" ON "Campaign"("season");
CREATE INDEX IF NOT EXISTS "Campaign_isActive_idx" ON "Campaign"("isActive");
