-- Adds a first-class productId to SellerLedgerEntry.
--
-- Until now the only record of which product a LISTING_FEE belonged to was the
-- free-text `description` ("Listing fee — product <cuid>"). Any duplicate-charge
-- guard would have had to LIKE-match that string, which breaks the moment the
-- wording changes or the description is localised.
--
-- Purely additive: nullable column plus an index. No DROP, no RENAME, no NOT
-- NULL, no default. Existing rows keep productId = NULL until the separate
-- backfill statement is run.
ALTER TABLE "SellerLedgerEntry" ADD COLUMN "productId" TEXT;

-- Supports the duplicate-charge lookup: "does this store already have a
-- LISTING_FEE for this product?" — storeId first because every ledger query is
-- already scoped to one store.
CREATE INDEX "SellerLedgerEntry_storeId_productId_type_idx"
  ON "SellerLedgerEntry" ("storeId", "productId", "type");
