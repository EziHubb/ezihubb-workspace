-- Real full-text search: Product.search_vector was referenced by raw SQL in
-- search.service.ts's hybrid full-text search path since the search module
-- was built, but the column never actually existed on the table — every
-- full-text query threw "column p.search_vector does not exist", was caught,
-- and silently fell back to slower, unranked ILIKE matching. Confirmed via a
-- live information_schema query against production before writing this.
--
-- GENERATED ALWAYS AS (...) STORED means Postgres computes and maintains
-- this column automatically on every insert/update — no trigger, no
-- application code needed to keep it in sync. Weighted so title matches
-- (A) rank above description matches (B), matching ts_rank's expectations
-- in search.service.ts's ORDER BY.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- CreateIndex
CREATE INDEX "Product_search_vector_idx" ON "Product" USING GIN ("search_vector");
