-- AlterTable: add purchase metadata to GiftCard
ALTER TABLE "GiftCard"
  ADD COLUMN "recipientEmail" TEXT,
  ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "personalMessage" TEXT,
  ADD COLUMN "purchasedByUserId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT;

-- CreateIndex: unique constraint on stripePaymentIntentId
CREATE UNIQUE INDEX "GiftCard_stripePaymentIntentId_key"
  ON "GiftCard"("stripePaymentIntentId");

-- AlterTable: add admin fields to User
ALTER TABLE "User"
  ADD COLUMN "adminNotes" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
