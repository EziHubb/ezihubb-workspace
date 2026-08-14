-- Etsy Share & Save: track WHO shared a link, distinct from who clicked it.
-- Without this, "Share & Save" was really just a public discount anyone
-- could self-serve by hand-appending a generic tracking param — a real
-- referral reward has to identify the sharer as a distinct party from the
-- buyer who eventually converts.

-- AlterTable
ALTER TABLE "StoreLinkClick" ADD COLUMN "sharerId" TEXT;
