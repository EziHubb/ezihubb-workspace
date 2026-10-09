-- Prospective replay protection. Existing orders and statuses are untouched.
CREATE TABLE "TrackingDeliveryReceipt" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "eventHash" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrackingDeliveryReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrackingDeliveryReceipt_eventHash_key" ON "TrackingDeliveryReceipt"("eventHash");
CREATE INDEX "TrackingDeliveryReceipt_orderId_idx" ON "TrackingDeliveryReceipt"("orderId");
