-- Per-order delivery-upgrade flag, distinct from the existing shop-level
-- Store.deliveryUpgradesEnabled toggle, so the Orders "Upgrade requested"
-- filter reflects a real per-order signal instead of always reading false.
ALTER TABLE "StoreOrder" ADD COLUMN "deliveryUpgradeRequested" BOOLEAN NOT NULL DEFAULT false;
