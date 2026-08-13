-- "Shop follows" (Etsy-parity) — a buyer following a store. Powers the
-- follow button on the storefront shop page and the real "Shop follows"
-- Shopper Stat on the seller Stats page (previously a fake stand-in metric).

-- CreateTable
CREATE TABLE "StoreFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreFollow_storeId_idx" ON "StoreFollow"("storeId");

-- CreateIndex
CREATE INDEX "StoreFollow_userId_idx" ON "StoreFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFollow_userId_storeId_key" ON "StoreFollow"("userId", "storeId");

-- AddForeignKey
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
