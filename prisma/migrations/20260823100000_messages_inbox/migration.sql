-- Inbox: folders, labels, starring, buyer notes, temporary auto-reply.
--
-- Note on the enum: this adds two values and never uses them in the same
-- migration. Postgres allows ALTER TYPE ... ADD VALUE inside a transaction
-- from 12 onwards but forbids USING the new value there, so any backfill that
-- files a thread as ARCHIVED or TRASHED would have to be a separate migration.
-- There is no such backfill here, by design.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationStatus" ADD VALUE 'ARCHIVED';
ALTER TYPE "ConversationStatus" ADD VALUE 'TRASHED';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "hasSellerReplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusBeforeFiling" "ConversationStatus";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachedProductId" TEXT;

-- CreateTable
CREATE TABLE "ConversationLabel" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'muted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationLabelLink" (
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationLabelLink_pkey" PRIMARY KEY ("conversationId","labelId")
);

-- CreateTable
CREATE TABLE "BuyerNote" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "buyerKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreAutoReply" (
    "storeId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "activeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreAutoReply_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE INDEX "ConversationLabel_storeId_idx" ON "ConversationLabel"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationLabel_storeId_name_key" ON "ConversationLabel"("storeId", "name");

-- CreateIndex
CREATE INDEX "ConversationLabelLink_labelId_idx" ON "ConversationLabelLink"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerNote_storeId_buyerKey_key" ON "BuyerNote"("storeId", "buyerKey");

-- CreateIndex
CREATE INDEX "Conversation_storeId_status_lastMessageAt_idx" ON "Conversation"("storeId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_storeId_isStarred_idx" ON "Conversation"("storeId", "isStarred");

-- CreateIndex
CREATE INDEX "Message_attachedProductId_idx" ON "Message"("attachedProductId");

-- AddForeignKey
ALTER TABLE "ConversationLabel" ADD CONSTRAINT "ConversationLabel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationLabelLink" ADD CONSTRAINT "ConversationLabelLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationLabelLink" ADD CONSTRAINT "ConversationLabelLink_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "ConversationLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerNote" ADD CONSTRAINT "BuyerNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAutoReply" ADD CONSTRAINT "StoreAutoReply_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachedProductId_fkey" FOREIGN KEY ("attachedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────
-- hasSellerReplied drives both the reply arrow on each inbox row and the Sent
-- folder. Computed once here rather than left false, which would show every
-- existing thread as never answered.

UPDATE "Conversation" c
SET "hasSellerReplied" = TRUE
WHERE EXISTS (
  SELECT 1 FROM "Message" m
  WHERE m."conversationId" = c."id" AND m."senderType" = 'SHOP'
);

-- statusBeforeFiling stays null everywhere: nothing is ARCHIVED or TRASHED
-- yet, and a value here would claim a thread had been filed when it had not.
