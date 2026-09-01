-- Older cancellation code updated only the parent Order. Reconcile the
-- seller-facing fulfilment row so cancelled orders leave the active queue.
UPDATE "StoreOrder" AS store_order
SET
  "status" = parent_order."status",
  "updatedAt" = NOW()
FROM "Order" AS parent_order
WHERE store_order."orderId" = parent_order."id"
  AND parent_order."status" IN ('CANCELLED', 'REFUNDED')
  AND store_order."status" IS DISTINCT FROM parent_order."status";
