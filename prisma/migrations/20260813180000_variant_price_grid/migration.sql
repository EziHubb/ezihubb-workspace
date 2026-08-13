-- ProductVariant rows were previously only ever created at product-creation
-- time (explicit `variants` list or CSV/Etsy import) — the "Manage
-- variations" admin UI (VariationGroup/VariationOption CRUD) never generated
-- or synced them. This meant sellers building variations from scratch could
-- never actually check out with a selected variant. This migration switches
-- ProductVariant to a real per-combination price grid (matching Etsy):
-- price becomes nullable (blank until the seller fills it in), quantity
-- becomes per-combination, and isAvailable is both the seller-facing
-- "Visible" toggle and how stale combinations get retired without ever
-- being hard-deleted (protects ProductFulfillmentMapping's cascade-delete
-- and CartItem/OrderItem/DigitalFile's variant FK from silently breaking).

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "price" DROP NOT NULL;
ALTER TABLE "ProductVariant" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;
