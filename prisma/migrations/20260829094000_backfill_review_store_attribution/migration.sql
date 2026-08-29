-- Reviews created before store attribution was wired into the submission flow
-- cannot appear in a shop's moderation queue. Prefer the immutable order-item
-- snapshot and fall back to the product's current owner for legacy rows.
WITH review_store AS (
  SELECT
    review."id" AS "reviewId",
    COALESCE(
      (
        SELECT item."storeId"
        FROM "OrderItem" item
        WHERE item."orderId" = review."orderId"
          AND item."productId" = review."productId"
          AND item."storeId" IS NOT NULL
        ORDER BY item."createdAt", item."id"
        LIMIT 1
      ),
      product."storeId"
    ) AS "storeId"
  FROM "Review" review
  JOIN "Product" product ON product."id" = review."productId"
  WHERE review."storeId" IS NULL
)
UPDATE "Review" review
SET "storeId" = review_store."storeId"
FROM review_store
WHERE review."id" = review_store."reviewId"
  AND review_store."storeId" IS NOT NULL;
