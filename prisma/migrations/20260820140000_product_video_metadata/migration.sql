-- Structured product video: poster frames + duration, replacing the bare
-- Product.videoUrls string array.
--
-- Product.videoUrls is deliberately NOT dropped here. It is still written and
-- still returned by the API so that any third-party integration reading it
-- keeps working; dropping it is a separate, announced migration.

CREATE TABLE "ProductVideo" (
    "id"              TEXT             NOT NULL,
    "productId"       TEXT             NOT NULL,
    "url"             TEXT             NOT NULL,
    "posterUrl"       TEXT,
    "posterSquareUrl" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "sortOrder"       INTEGER          NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVideo_productId_idx" ON "ProductVideo"("productId");

ALTER TABLE "ProductVideo"
    ADD CONSTRAINT "ProductVideo_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one row per existing URL, preserving array order via ORDINALITY.
--
-- id: 'c' + 24 hex chars matches the CUID v1 shape that ParseCuidPipe accepts
-- (^c[a-z0-9]{24}$). Postgres cannot mint a real cuid, and a uuid would be
-- rejected by that pipe the first time someone called DELETE on one of these
-- rows — so the generated id has to be cuid-SHAPED, not merely unique.
--
-- createdAt: the product's own creation time, NOT now(). These videos were
-- uploaded at some unknown point in the past; stamping them with the migration
-- run time would claim every legacy video was uploaded the moment we deployed,
-- which is visibly false in any "uploaded" column. The product's createdAt is
-- at least a true lower bound.
--
-- posterUrl / durationSeconds stay NULL: no frame was ever extracted and no
-- duration was ever persisted for these. Null reads as "never measured"; a 0
-- would render as a real, wrong value.
INSERT INTO "ProductVideo" ("id", "productId", "url", "sortOrder", "createdAt")
SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text || p."id" || v.ord::text), 1, 24),
    p."id",
    v.url,
    (v.ord - 1)::int,
    p."createdAt"
FROM "Product" p
CROSS JOIN LATERAL unnest(p."videoUrls") WITH ORDINALITY AS v(url, ord)
WHERE p."videoUrls" IS NOT NULL
  AND array_length(p."videoUrls", 1) > 0;
