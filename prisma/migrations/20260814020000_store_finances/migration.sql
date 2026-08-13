-- Etsy-parity "Finances" module: seller bank deposit account, billing card
-- (Stripe-backed, for auto-billing platform fees), and legal/tax profile.

-- AlterEnum
ALTER TYPE "SellerLedgerEntryType" ADD VALUE 'VAT';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE 'DEPOSIT_FEE';

-- CreateEnum
CREATE TYPE "DepositSchedule" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "autoBillingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "vatOnFeesRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10;

-- CreateTable
CREATE TABLE "StoreBankAccount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "depositSchedule" "DepositSchedule" NOT NULL DEFAULT 'WEEKLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBillingCard" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreBillingCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreTaxInfo" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sellerType" "SellerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "fullLegalName" TEXT NOT NULL,
    "taxpayerIdEncrypted" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "country" VARCHAR(2) NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "flatOther" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "postCode" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreTaxInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreBankAccount_storeId_key" ON "StoreBankAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBillingCard_stripePaymentMethodId_key" ON "StoreBillingCard"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "StoreBillingCard_storeId_idx" ON "StoreBillingCard"("storeId");

-- CreateIndex
CREATE INDEX "StoreBillingCard_storeId_fingerprint_idx" ON "StoreBillingCard"("storeId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTaxInfo_storeId_key" ON "StoreTaxInfo"("storeId");

-- AddForeignKey
ALTER TABLE "StoreBankAccount" ADD CONSTRAINT "StoreBankAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBillingCard" ADD CONSTRAINT "StoreBillingCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTaxInfo" ADD CONSTRAINT "StoreTaxInfo_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
