-- Sales tax calculation removed entirely (fallback rate table was not
-- compliance-grade and no real tax provider was ever configured in production).
ALTER TABLE "Order" DROP COLUMN "taxAmount",
                    DROP COLUMN "taxRate",
                    DROP COLUMN "taxJurisdiction",
                    DROP COLUMN "taxExempt";
