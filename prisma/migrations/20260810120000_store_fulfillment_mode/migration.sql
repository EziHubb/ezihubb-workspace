-- A store's fulfillment provider mapping already implicitly meant "manual" whenever
-- no ProductFulfillmentMapping existed (the queue processor just no-op'd), but that
-- state was silent and undiscoverable. This makes "I'll fulfill orders myself instead
-- of Printify/Merchize" a first-class, settable choice that the queue processor checks
-- explicitly before ever attempting an auto-push, regardless of any leftover mappings.
CREATE TYPE "StoreFulfillmentMode" AS ENUM ('AUTOMATIC', 'MANUAL');
ALTER TABLE "Store" ADD COLUMN "fulfillmentMode" "StoreFulfillmentMode" NOT NULL DEFAULT 'AUTOMATIC';
