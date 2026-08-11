-- Remove the referral program ("Creator Network") entirely.
-- Confirmed via a live production query before writing this migration: all
-- four Referral* tables are empty (0 rows), 0 users have referredByUserId
-- set or referralBalance > 0, and 0 orders have referralUserId set — this
-- feature was never actually used, so this drop carries zero data loss.
--
-- Generated with `prisma migrate diff --from-schema <prev> --to-schema
-- prisma/schema.prisma --script` against the schema edit that removed the
-- Referral* models and fields, rather than hand-written — this involves
-- enough interlocking FKs (User<->ReferralTier, User self-FK, Order->User,
-- ReferralCommission->User/Order) that letting Prisma's own diff engine
-- produce the drop order is safer than reasoning through it by hand.

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referredByUserId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referralTierId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_referralUserId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralCommission" DROP CONSTRAINT "ReferralCommission_earnerId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralCommission" DROP CONSTRAINT "ReferralCommission_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralCommission" DROP CONSTRAINT "ReferralCommission_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralPayout" DROP CONSTRAINT "ReferralPayout_userId_fkey";

-- DropIndex
DROP INDEX "User_referralCode_key";

-- DropIndex
DROP INDEX "Order_referralUserId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referralBalance",
DROP COLUMN "referralCode",
DROP COLUMN "referralDepth",
DROP COLUMN "referralEarned",
DROP COLUMN "referralTierId",
DROP COLUMN "referredByUserId",
DROP COLUMN "totalReferrals";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "referralDiscountAmount",
DROP COLUMN "referralUserId";

-- DropTable
DROP TABLE "ReferralSettings";

-- DropTable
DROP TABLE "ReferralTier";

-- DropTable
DROP TABLE "ReferralCommission";

-- DropTable
DROP TABLE "ReferralPayout";

-- DropEnum
DROP TYPE "ReferralCommissionStatus";

-- DropEnum
DROP TYPE "ReferralPayoutStatus";
