-- One conversation per (shop, buyer), not per order.
--
-- A thread used to be created for each order, so a buyer with five orders from
-- the same shop had five separate threads all showing the same shop name, and
-- neither side could see the relationship in one place. The order becomes
-- context on the thread instead of the thing that identifies it.
--
-- Written as a repeated CTE rather than a temp table on purpose: a temp table
-- ties every statement to one session, which makes the whole file work only
-- when run as a single blob — and therefore impossible to exercise
-- statement-by-statement before trusting it. The CTE costs a little repetition
-- and buys a migration that can be tested.

-- ── 0. Normalise the guest emails already stored ────────────────────────────
-- The index below is on lower("guestEmail"), but the application looks a guest
-- up with an ordinary equality on a lower-cased string. A row still holding
-- "Bob@Example.com" therefore matches the index and NOT the lookup: the code
-- would decide the thread does not exist, try to create it, and take a unique
-- violation — a 500 for a returning guest buyer, on the shop's busiest path.
--
-- Storing what the code searches for is the fix. Done before the merge so the
-- grouping and the stored value agree from here on.
UPDATE "Conversation"
SET "guestEmail" = lower("guestEmail")
WHERE "guestEmail" IS NOT NULL AND "guestEmail" <> lower("guestEmail");

-- ── 1. Labels first: the link table's key is composite ──────────────────────
-- Moving a link whose label the keeper already carries would violate that key,
-- so insert what is missing and drop the originals rather than UPDATE.
INSERT INTO "ConversationLabelLink" ("conversationId", "labelId")
SELECT DISTINCT m.keep_id, l."labelId"
FROM "ConversationLabelLink" l
JOIN (
  WITH grp AS (
    SELECT id, "storeId",
           COALESCE("userId", 'guest:' || lower("guestEmail")) AS buyer_key,
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", COALESCE("userId", 'guest:' || lower("guestEmail"))
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "Conversation"
    WHERE "storeId" IS NOT NULL AND COALESCE("userId", "guestEmail") IS NOT NULL
  )
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM grp d JOIN grp k
    ON k."storeId" = d."storeId" AND k.buyer_key = d.buyer_key AND k.rn = 1
  WHERE d.rn > 1
) m ON m.dup_id = l."conversationId"
ON CONFLICT DO NOTHING;

DELETE FROM "ConversationLabelLink" l
USING (
  WITH grp AS (
    SELECT id, "storeId",
           COALESCE("userId", 'guest:' || lower("guestEmail")) AS buyer_key,
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", COALESCE("userId", 'guest:' || lower("guestEmail"))
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "Conversation"
    WHERE "storeId" IS NOT NULL AND COALESCE("userId", "guestEmail") IS NOT NULL
  )
  SELECT d.id AS dup_id FROM grp d WHERE d.rn > 1
) m
WHERE l."conversationId" = m.dup_id;

-- ── 2. Roll the keeper's counters forward BEFORE the rows are gone ──────────
-- Unread counts add up, the newest message wins, and a flag set on any thread
-- stays set. Keeping only the keeper's own values would silently mark the
-- other threads' unread messages as read.
UPDATE "Conversation" c
SET "unreadByAdmin"    = agg.unread_admin,
    "unreadByCustomer" = agg.unread_customer,
    "isStarred"        = agg.starred,
    "hasSellerReplied" = agg.replied,
    "lastMessageAt"    = agg.last_at,
    "lastMessage"      = COALESCE(agg.last_body, c."lastMessage"),
    "orderId"          = COALESCE(agg.any_order, c."orderId")
FROM (
  WITH grp AS (
    SELECT id, "storeId",
           COALESCE("userId", 'guest:' || lower("guestEmail")) AS buyer_key,
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", COALESCE("userId", 'guest:' || lower("guestEmail"))
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "Conversation"
    WHERE "storeId" IS NOT NULL AND COALESCE("userId", "guestEmail") IS NOT NULL
  ),
  pair AS (
    SELECT g.id AS member_id,
           FIRST_VALUE(g.id) OVER (
             PARTITION BY g."storeId", g.buyer_key ORDER BY g.rn
           ) AS keep_id
    FROM grp g
  )
  SELECT p.keep_id,
         SUM(x."unreadByAdmin")::int    AS unread_admin,
         SUM(x."unreadByCustomer")::int AS unread_customer,
         BOOL_OR(x."isStarred")         AS starred,
         BOOL_OR(x."hasSellerReplied")  AS replied,
         MAX(x."lastMessageAt")         AS last_at,
         (ARRAY_AGG(x."lastMessage" ORDER BY x."lastMessageAt" DESC NULLS LAST))[1] AS last_body,
         (ARRAY_AGG(x."orderId"     ORDER BY x."lastMessageAt" DESC NULLS LAST))[1] AS any_order
  FROM pair p
  JOIN "Conversation" x ON x.id = p.member_id
  GROUP BY p.keep_id
  HAVING COUNT(*) > 1
) agg
WHERE c.id = agg.keep_id;

-- ── 3. Messages ─────────────────────────────────────────────────────────────
UPDATE "Message" msg
SET "conversationId" = m.keep_id
FROM (
  WITH grp AS (
    SELECT id, "storeId",
           COALESCE("userId", 'guest:' || lower("guestEmail")) AS buyer_key,
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", COALESCE("userId", 'guest:' || lower("guestEmail"))
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "Conversation"
    WHERE "storeId" IS NOT NULL AND COALESCE("userId", "guestEmail") IS NOT NULL
  )
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM grp d JOIN grp k
    ON k."storeId" = d."storeId" AND k.buyer_key = d.buyer_key AND k.rn = 1
  WHERE d.rn > 1
) m
WHERE msg."conversationId" = m.dup_id;

-- ── 4. Drop the folded threads ──────────────────────────────────────────────
DELETE FROM "Conversation" c
USING (
  WITH grp AS (
    SELECT id, "storeId",
           COALESCE("userId", 'guest:' || lower("guestEmail")) AS buyer_key,
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", COALESCE("userId", 'guest:' || lower("guestEmail"))
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "Conversation"
    WHERE "storeId" IS NOT NULL AND COALESCE("userId", "guestEmail") IS NOT NULL
  )
  SELECT d.id AS dup_id FROM grp d WHERE d.rn > 1
) m
WHERE c.id = m.dup_id;

-- ── 5. Stop it happening again ──────────────────────────────────────────────
-- Partial, so they bind only the rows the rule is about: a thread with no shop,
-- or with neither an account nor a guest email, is outside it. Prisma cannot
-- express a partial index, so these live only here — see the Conversation model.
CREATE UNIQUE INDEX "Conversation_store_user_key"
  ON "Conversation" ("storeId", "userId")
  WHERE "storeId" IS NOT NULL AND "userId" IS NOT NULL;

CREATE UNIQUE INDEX "Conversation_store_guest_key"
  ON "Conversation" ("storeId", lower("guestEmail"))
  WHERE "storeId" IS NOT NULL AND "userId" IS NULL AND "guestEmail" IS NOT NULL;
