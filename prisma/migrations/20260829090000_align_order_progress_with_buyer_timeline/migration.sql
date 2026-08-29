-- Align the seller workflow with the five buyer-visible fulfilment milestones.
-- CUSTOM remains seller-defined detail, but always represents IN_PRODUCTION
-- outside the shop.

-- Rebuild the enum rather than ALTER TYPE ... ADD VALUE: PostgreSQL does not
-- allow a newly added enum value to be used later in the same transaction.
ALTER TABLE "OrderProgressStep" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TYPE "OrderProgressStepKind" RENAME TO "OrderProgressStepKind_old";
CREATE TYPE "OrderProgressStepKind" AS ENUM (
  'CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CUSTOM'
);
ALTER TABLE "OrderProgressStep"
  ALTER COLUMN "kind" TYPE "OrderProgressStepKind"
  USING (
    CASE "kind"::text
      WHEN 'NEW' THEN 'CONFIRMED'
      ELSE "kind"::text
    END
  )::"OrderProgressStepKind";
DROP TYPE "OrderProgressStepKind_old";
ALTER TABLE "OrderProgressStep" ALTER COLUMN "kind" SET DEFAULT 'CUSTOM';

-- Preserve an existing seller step named In Progress/In Production as the
-- required milestone, including every order already pointing to its id.
WITH candidates AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "storeId"
    ORDER BY "sortOrder", "createdAt", "id"
  ) AS rn
  FROM "OrderProgressStep"
  WHERE "kind" = 'CUSTOM'
    AND LOWER(TRIM("name")) IN ('in progress', 'in production')
)
UPDATE "OrderProgressStep" step
SET "kind" = 'IN_PRODUCTION',
    "name" = 'In Production',
    "sortOrder" = 100,
    "updatedAt" = NOW()
FROM candidates candidate
WHERE step."id" = candidate."id"
  AND candidate.rn = 1;

-- Add any missing locked milestones for every existing store.
INSERT INTO "OrderProgressStep" ("id", "storeId", "name", "kind", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, store."id", fixed."name", fixed."kind"::"OrderProgressStepKind", fixed."sortOrder", NOW(), NOW()
FROM "Store" store
CROSS JOIN (VALUES
  ('Confirmed',     'CONFIRMED',     0),
  ('In Production', 'IN_PRODUCTION', 100),
  ('Shipped',       'SHIPPED',       800),
  ('Delivered',     'DELIVERED',     900),
  ('Completed',     'COMPLETED',     1000)
) AS fixed("name", "kind", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1
  FROM "OrderProgressStep" existing
  WHERE existing."storeId" = store."id"
    AND existing."kind" = fixed."kind"::"OrderProgressStepKind"
);

-- Normalize locked labels/positions and place custom detail inside the
-- production phase without changing custom ids or names.
UPDATE "OrderProgressStep"
SET "name" = CASE "kind"
      WHEN 'CONFIRMED'     THEN 'Confirmed'
      WHEN 'IN_PRODUCTION' THEN 'In Production'
      WHEN 'SHIPPED'       THEN 'Shipped'
      WHEN 'DELIVERED'     THEN 'Delivered'
      WHEN 'COMPLETED'     THEN 'Completed'
      ELSE "name"
    END,
    "sortOrder" = CASE "kind"
      WHEN 'CONFIRMED'     THEN 0
      WHEN 'IN_PRODUCTION' THEN 100
      WHEN 'SHIPPED'       THEN 800
      WHEN 'DELIVERED'     THEN 900
      WHEN 'COMPLETED'     THEN 1000
      ELSE "sortOrder"
    END,
    "updatedAt" = NOW()
WHERE "kind" <> 'CUSTOM';

WITH ranked_custom AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "storeId"
    ORDER BY "sortOrder", "createdAt", "id"
  ) - 1 AS position
  FROM "OrderProgressStep"
  WHERE "kind" = 'CUSTOM'
)
UPDATE "OrderProgressStep" step
SET "sortOrder" = (200 + ranked_custom.position)::integer,
    "updatedAt" = NOW()
FROM ranked_custom
WHERE step."id" = ranked_custom."id";

-- Existing orders already sitting on custom/production work become public
-- IN_PRODUCTION immediately instead of waiting for the seller's next move.
UPDATE "StoreOrder" store_order
SET "status" = 'IN_PRODUCTION',
    "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE store_order."progressStepId" = step."id"
  AND step."kind" IN ('CUSTOM', 'IN_PRODUCTION')
  AND store_order."status" = 'CONFIRMED';

-- Put every fulfilment state on its matching fixed milestone. IN_PRODUCTION
-- keeps a custom step when one exists, because that detail is useful to the
-- seller and already maps to the same public status.
UPDATE "StoreOrder" store_order
SET "progressStepId" = step."id", "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE step."storeId" = store_order."storeId"
  AND step."kind" = 'CONFIRMED'
  AND store_order."status" = 'CONFIRMED';

UPDATE "StoreOrder" store_order
SET "progressStepId" = step."id", "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE step."storeId" = store_order."storeId"
  AND step."kind" = 'IN_PRODUCTION'
  AND store_order."status" = 'IN_PRODUCTION'
  AND NOT EXISTS (
    SELECT 1 FROM "OrderProgressStep" current_step
    WHERE current_step."id" = store_order."progressStepId"
      AND current_step."kind" = 'CUSTOM'
  );

UPDATE "StoreOrder" store_order
SET "progressStepId" = step."id", "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE step."storeId" = store_order."storeId"
  AND step."kind" = 'SHIPPED'
  AND store_order."status" = 'SHIPPED';

UPDATE "StoreOrder" store_order
SET "progressStepId" = step."id", "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE step."storeId" = store_order."storeId"
  AND step."kind" = 'DELIVERED'
  AND store_order."status" = 'DELIVERED';

UPDATE "StoreOrder" store_order
SET "progressStepId" = step."id", "updatedAt" = NOW()
FROM "OrderProgressStep" step
WHERE step."storeId" = store_order."storeId"
  AND step."kind" = 'COMPLETED'
  AND store_order."status" = 'COMPLETED';

-- A multi-shop order is only as advanced as its least advanced active shop,
-- matching the runtime aggregation rule.
WITH ranked_orders AS (
  SELECT store_order."orderId",
         MIN(CASE store_order."status"
           WHEN 'CONFIRMED'     THEN 0
           WHEN 'IN_PRODUCTION' THEN 1
           WHEN 'SHIPPED'       THEN 2
           WHEN 'DELIVERED'     THEN 3
           WHEN 'COMPLETED'     THEN 4
         END) AS min_rank
  FROM "StoreOrder" store_order
  WHERE store_order."status" IN ('CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED')
  GROUP BY store_order."orderId"
), derived AS (
  SELECT "orderId",
         CASE min_rank
           WHEN 0 THEN 'CONFIRMED'
           WHEN 1 THEN 'IN_PRODUCTION'
           WHEN 2 THEN 'SHIPPED'
           WHEN 3 THEN 'DELIVERED'
           WHEN 4 THEN 'COMPLETED'
         END::"OrderStatus" AS status
  FROM ranked_orders
)
UPDATE "Order" parent_order
SET "status" = derived.status,
    "updatedAt" = NOW()
FROM derived
WHERE parent_order."id" = derived."orderId"
  AND parent_order."status" IN ('CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED')
  AND parent_order."status" <> derived.status;
