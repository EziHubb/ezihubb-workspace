-- Additive only. Does not enqueue historical paid/delivered orders.
CREATE TABLE "OrderEventOutbox" (
  "id" TEXT NOT NULL DEFAULT nanoid(12),
  "orderId" TEXT NOT NULL,
  "eventType" VARCHAR(30) NOT NULL,
  "state" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" VARCHAR(36),
  "leaseUntil" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEventOutbox_pkey" PRIMARY KEY ("id"),
  CHECK ("eventType" IN ('ORDER_PAID', 'ORDER_DELIVERED')),
  CHECK ("state" IN ('PENDING', 'QUEUED', 'SKIPPED')),
  CHECK ("attempts" >= 0),
  CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL))
);
CREATE UNIQUE INDEX "OrderEventOutbox_eventType_orderId_key" ON "OrderEventOutbox"("eventType", "orderId");
CREATE INDEX "OrderEventOutbox_state_nextAttemptAt_idx" ON "OrderEventOutbox"("state", "nextAttemptAt");
