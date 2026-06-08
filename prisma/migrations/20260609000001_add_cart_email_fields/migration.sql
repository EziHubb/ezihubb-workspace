-- AlterTable: Add cart email opt-out fields to User
ALTER TABLE "User" ADD COLUMN "cartEmailToken" TEXT;
ALTER TABLE "User" ADD COLUMN "cartEmailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: unique token for unsubscribe links
CREATE UNIQUE INDEX "User_cartEmailToken_key" ON "User"("cartEmailToken");

-- AlterTable: Add abandoned email tracking to Cart
ALTER TABLE "Cart" ADD COLUMN "abandonedEmailSentAt" TIMESTAMP(3);
