-- Third leg of the listing-provenance trio (whoMadeIt, howItWasMade,
-- whenMade), plus whether the seller offers gift wrapping on a listing.
-- Backs the "item type" and "ordering options" filter groups.
--
-- whenMade is NULLABLE and has no default, matching whoMadeIt and
-- howItWasMade beside it. A question the seller has not answered stays
-- unanswered; defaulting every existing listing to RECENTLY_MADE would put a
-- claim on their behalf that they never made, and the filter would then be
-- reporting made-up data as fact.
--
-- giftWrappingAvailable does take a default, because false is the honest
-- answer for a listing where the option was never offered.
--
-- Purely additive: nothing dropped or renamed, no backfill, no NULL window.
-- Safe to apply while the app is running, and safe to roll the code back
-- afterwards — the previous image never selects either column.

CREATE TYPE "WhenMade" AS ENUM ('RECENTLY_MADE', 'VINTAGE');

ALTER TABLE "Product"
  ADD COLUMN "whenMade" "WhenMade",
  ADD COLUMN "giftWrappingAvailable" BOOLEAN NOT NULL DEFAULT false;
