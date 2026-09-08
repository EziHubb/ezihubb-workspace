ALTER TABLE "Order" ADD COLUMN "adminArchivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminArchivedBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "adminArchiveReason" VARCHAR(500);
ALTER TABLE "SellerLedgerEntry" ADD COLUMN "reversalOfId" TEXT;
CREATE UNIQUE INDEX "SellerLedgerEntry_reversalOfId_key" ON "SellerLedgerEntry"("reversalOfId");

-- Repair legacy cancelled orders at migration time, without rewriting old
-- statements. Settled payouts stay intact; their reversals debit the next balance.
INSERT INTO "SellerLedgerEntry" (
  id, "storeId", "storeOrderId", type, amount, description, "reversalOfId", "createdAt"
)
SELECT nanoid(12), e."storeId", e."storeOrderId", e.type, -e.amount,
       'Cancellation reversal: ' || e.description, e.id, CURRENT_TIMESTAMP
FROM "SellerLedgerEntry" e
JOIN "StoreOrder" so ON so.id = e."storeOrderId"
JOIN "Order" o ON o.id = so."orderId"
WHERE o.status = 'CANCELLED' AND e."reversalOfId" IS NULL
ON CONFLICT ("reversalOfId") DO NOTHING;
