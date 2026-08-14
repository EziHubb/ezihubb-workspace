-- Etsy-parity fix: a seller-scoped coupon must reduce that store's own
-- StoreOrder (and therefore seller earnings/fees/SALE ledger credit), not
-- just the platform-level Order total. Adds the missing per-store discount
-- column so the checkout allocation fix has somewhere real to store it.

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
