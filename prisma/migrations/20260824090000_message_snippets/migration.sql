-- Reusable message bodies a shop keeps to hand, inserted into the composer by
-- the seller. Separate from "StoreAutoReply", which sends itself.

CREATE TABLE "MessageSnippet" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageSnippet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageSnippet_storeId_idx" ON "MessageSnippet"("storeId");

-- Two snippets with the same name are indistinguishable in the picker.
CREATE UNIQUE INDEX "MessageSnippet_storeId_title_key" ON "MessageSnippet"("storeId", "title");

ALTER TABLE "MessageSnippet" ADD CONSTRAINT "MessageSnippet_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
