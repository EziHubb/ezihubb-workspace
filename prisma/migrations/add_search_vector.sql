-- Migration: Add full-text search vector to Product table
-- Run AFTER prisma migrate dev (the generated Prisma migration creates the table).
-- This adds a GIN-indexed generated column that powers /search?q= queries.
--
-- Usage:
--   psql $DATABASE_URL -f prisma/migrations/add_search_vector.sql
--   (or run the statements manually in your DB client)

-- 1. Add the generated tsvector column
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce("shortDescription", '')), 'C')
  ) STORED;

-- 2. Create GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS product_search_idx ON "Product" USING gin(search_vector);

-- Verify
-- SELECT name, search_vector FROM "Product" LIMIT 3;
