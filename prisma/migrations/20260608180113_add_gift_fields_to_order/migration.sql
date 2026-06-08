-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftFrom" VARCHAR(100),
ADD COLUMN     "giftMessage" VARCHAR(500),
ADD COLUMN     "giftReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "giftWrapping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false;
