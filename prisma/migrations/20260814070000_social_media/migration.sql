-- Etsy-parity Marketing: Social media (UI-parity only — no real OAuth/posting).

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'PINTEREST', 'X');
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "StoreSocialConnection" (
    "id"          TEXT NOT NULL,
    "storeId"     TEXT NOT NULL,
    "platform"    "SocialPlatform" NOT NULL,
    "status"      "SocialConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "connectedAt" TIMESTAMP(3),

    CONSTRAINT "StoreSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSocialConnection_storeId_platform_key" ON "StoreSocialConnection"("storeId", "platform");

-- AddForeignKey
ALTER TABLE "StoreSocialConnection" ADD CONSTRAINT "StoreSocialConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SocialPost" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "imageUrl"  TEXT,
    "platforms" "SocialPlatform"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_storeId_createdAt_idx" ON "SocialPost"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
