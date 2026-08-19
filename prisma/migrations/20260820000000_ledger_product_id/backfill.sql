-- RUN ORDER: apply migration.sql in this folder FIRST, then this file.
-- It writes to a column that does not exist until that migration has run, so
-- running it early fails with "column productId does not exist".
--
-- NOT RUN AUTOMATICALLY. Prisma only executes migration.sql in this folder;
-- this file is here so the statement lives next to the schema change it
-- belongs to. Run it by hand, once, after the migration is applied.
--
-- EXPECTED, NOT A FAILURE: 2 of the 5 rows this backfills reference products
-- that were hard-deleted from "Product". Those ids are still correct — they are
-- the listing the seller was actually billed for — and the column has no
-- foreign key precisely so the fee history survives the listing. If a later
-- integrity check flags them as orphans, that is the ledger doing its job, not
-- a bug in this statement. See docs/listing-fee.md.
--
-- Backfills SellerLedgerEntry.productId for rows written before the column
-- existed, by extracting the cuid from the free-text description.
--
-- Both writers produce a description ending in the product id:
--   LISTING_FEE : "Listing fee — product <cuid>"
--   VAT         : "VAT: listing — product <cuid>"
-- The pattern anchors on the trailing "product <id>" and so does not depend on
-- the em dash or the leading wording. Verified against all 5 rows currently in
-- production: 5/5 extract correctly.
--
-- Safe to re-run: the WHERE clause skips rows that already have a productId.
--
-- Note: two of the referenced products were hard-deleted from Product. The
-- column is a plain TEXT with no foreign key, deliberately, so those rows keep
-- their historical id and the backfill does not fail on them. Do not add an FK
-- to this column without deciding what should happen to fee history for
-- deleted listings.

UPDATE "SellerLedgerEntry"
SET    "productId" = substring(description from 'product ([a-z0-9]+)$')
WHERE  "productId" IS NULL
  AND  type IN ('LISTING_FEE', 'VAT')
  AND  description ~ 'product [a-z0-9]+$';

-- Verify afterwards — expect 5 rows, none with a NULL productId:
--   SELECT type, "productId", description FROM "SellerLedgerEntry"
--   WHERE type IN ('LISTING_FEE','VAT') ORDER BY "createdAt";
