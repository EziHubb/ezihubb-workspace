# Listing fee

Why the platform's per-listing fee works the way it does, and the traps around
it. Written after an audit found sellers being billed for listings that were
never published and, in two cases, never existed.

## DEPLOY ORDER — migration first, code second

`publishProducts()` writes `SellerLedgerEntry.productId`. That column does not
exist until the migration runs. **Deploying the code first makes every publish
fail**, on both the bulk action and the seller's status toggle.

This is the opposite of the `featuredLayout` rollout, where the code tolerated a
missing column. Here the dependency is hard. Do not reorder these steps.

**1. Apply the migration**

```bash
docker compose run --rm migrate            # on the server, from $DEPLOY_PATH
```

Run it on its own and read the exit code. `scripts/deploy.sh` ends its migrate
step with `|| echo`, so a failure there does **not** abort the deploy.

**2. Confirm the column exists** — expect exactly one row, `is_nullable = YES`:

```sql
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'SellerLedgerEntry' AND column_name = 'productId';
```

Stop here if it returns nothing.

**3. Run the backfill**

```sql
-- prisma/migrations/20260820000000_ledger_product_id/backfill.sql
UPDATE "SellerLedgerEntry"
SET    "productId" = substring(description from 'product ([a-z0-9]+)$')
WHERE  "productId" IS NULL
  AND  type IN ('LISTING_FEE', 'VAT')
  AND  description ~ 'product [a-z0-9]+$';
```

**4. Confirm the backfill** — expect `missing = 0`:

```sql
SELECT count(*) FILTER (WHERE "productId" IS NULL) AS missing,
       count(*)                                    AS total
FROM   "SellerLedgerEntry"
WHERE  type IN ('LISTING_FEE', 'VAT');
```

As of 2026-08-19 that is 5 rows total, 0 missing after backfill.

**5. Deploy the code** — normal image pull + `docker compose up -d api`.

**6. Smoke test** — publish one listing, then check the fee carries its id:

```sql
SELECT type, "productId", amount, description
FROM   "SellerLedgerEntry"
WHERE  type = 'LISTING_FEE'
ORDER  BY "createdAt" DESC
LIMIT  2;
```

The newest row must have a non-null `productId`. Publish the same listing again
(unpublish, republish) and confirm **no** second `LISTING_FEE` row appears — that
proves the duplicate guard works against the real column, not just in tests.

### Rolling back step 5 is safe

The old image runs fine against the new column. It is nullable, and Prisma
generates explicit column lists rather than `SELECT *`, so a column the old
client does not know about is simply never read or written.

What comes back with the old code is the **old billing behaviour**: listings
charged at draft-creation time again. Roll back the code if you must, but treat
it as a live billing regression, not a neutral state.

Do **not** roll back the migration to "undo" the deploy. Dropping the column
destroys the backfilled links, and the fee history is the one thing here that
cannot be reconstructed once the descriptions and products diverge.

## The rule

**A listing fee is charged when a listing is published, once per product.**

Not when the seller opens the create form. Publishing is the moment the listing
becomes something buyers can see, and it is the moment the code itself already
treats as real — `createDraftForStore` fills in a placeholder category and a
throwaway SKU with comments saying `will be overwritten on publish` /
`will be replaced on publish`. Billing at a moment the author labelled as
temporary was the bug.

Republishing does not charge again. The guard is "does a `LISTING_FEE` entry
already exist for this `productId`?", so unpublish → publish, or any number of
later toggles, are free. The unit being paid for is the listing, not the act of
publishing.

Implemented by `ProductsService.publishProducts(ids)` — the single place that
turns a listing live. Both entry points call it: the publish/unpublish bulk
action and the seller's `PATCH /:id/status`. Nothing else may flip a listing to
published; splitting that rule across call sites is what produced the four
`isActive`/`status` desyncs below.

It is all-or-nothing: the ledger rows and the status flip share one
transaction. Publishing 200 listings where one fails rolls back all 200 rather
than leaving a seller billed for listings that never went live. The ledger write
has no `try/catch` — a billing failure must abort the publish, unlike the old
create-time charge which swallowed errors and lost revenue silently.

Creating a listing already active (`create` with `isActive` defaulting true)
routes through the same function, so it is billed once, by the same rule.

## What it was before

`chargeListingFee()` was called from `createDraftForStore()`, i.e. the instant
the seller clicked "create product", before a name or an image existed.

Consequences observed in production on 2026-08-19:

- 4 `LISTING_FEE` entries totalling `-0.80`, but only 2 products in the
  database. Two listings had been created, charged, then hard-deleted. Nothing
  refunds a listing fee — there is no reversal path anywhere in
  `products/` or `stores/`.
- Both surviving rows were empty drafts: `name: ''`, no images, no variants,
  `updatedAt == createdAt`. Neither had ever been edited, let alone published.

For a real seller that reads as: charged for something they never sold, and
charged again every time they mis-click.

## Test data — do not "fix" this

Store `cmsod5413003y0nmqb4lpf6vn` (slug `ezihubb`) is the maintainer's own test
shop, not a real seller. The `-0.82` balance on it (4 × listing fee `-0.20`,
plus 1 × VAT `-0.02`) is test data and is **deliberately not refunded**.

Only one of the four charges carries a VAT line because the VAT block was added
later, in `3f3b42a` (2026-08-14); three of the charges predate it. That is
chronology, not a missing-VAT bug.

## `SellerLedgerEntry.productId`

Added by migration `20260820000000_ledger_product_id`. Nullable `TEXT` plus
`@@index([storeId, productId, type])`.

Before it, the only link from a fee back to its product was the free-text
`description` (`"Listing fee — product <cuid>"`). A duplicate-charge guard would
have had to `LIKE`-match that string, which breaks the first time someone
rewords it or runs it through i18n.

Most entry types (SALE, TRANSACTION_FEE, payouts) are order-scoped and keep
using `storeOrderId`; `productId` stays NULL for those. That is why the column
is nullable.

### Do not add a foreign key to `productId`

It is deliberately a plain `TEXT` with no relation to `Product`.

Two of the five existing entries reference products that were hard-deleted
(`delete()` is a real delete, gated on the listing already being ARCHIVED). With
an FK those rows could not exist, and the backfill would fail on them.

Fee history has to outlive the listing it was charged for — that is the whole
point of a ledger. Before adding an FK, decide what should happen to the billing
record of a deleted listing; `ON DELETE CASCADE` would silently erase money the
seller actually paid.

## Backfill

`prisma/migrations/20260820000000_ledger_product_id/backfill.sql`. Prisma does
not run it — apply the migration first, then run it by hand, once.

It extracts the cuid from the trailing `product <id>` in `description`. Verified
against all 5 production rows: 5/5 extract correctly. Re-running is safe; the
`WHERE` skips rows that already have a `productId`.

Two of the backfilled ids point at products that no longer exist. That is
expected, not a backfill failure — see the FK note above.

## Related trap: `isActive` and `status` must move together

Not the fee itself, but it is what made the fee bug visible, and it bit three
separate times.

Every buyer-facing query goes through `buildWhereClause`, which requires **both**
`isActive: true` **and** `status != DRAFT`. Six places write `isActive` on a
Product and each one has to remember to write `status` too. Three of them did
not:

| Site | Was | Now |
|---|---|---|
| `createDraftForStore` | no `status` → schema default `ACTIVE` | `DRAFT` |
| `updateForStore` | wrote `isActive` only | derives `ACTIVE`/`INACTIVE` |
| `create` | no `status` when `isActive:false` | derives `ACTIVE`/`INACTIVE` |
| `duplicate` | no `status` → default `ACTIVE` | `DRAFT` |

Storefront visibility was never affected — `isActive` alone kept unpublished
listings hidden. What broke was the seller dashboard's tab counts, which read
`status` alone: two abandoned drafts were reported as `active: 2, draft: 0`.
Those two rows were corrected in place on 2026-08-19 (2 rows, in a transaction,
guarded on matching exactly 2).

A fifth site, `createDraft` (the platform-context SUPER_ADMIN path), already set
`DRAFT` correctly — which is why only the seller-facing path produced bad rows
in production.

## Decision: partial failure in bulk publish

Publishing a batch is **all-or-nothing**. One transaction covers the whole
batch; if the 7th of 10 fails, none of the 10 publish and none are billed.

The alternative — commit what succeeded, report the rest — was rejected. It
allows the ledger and product status to disagree, and reconciling "which of
these 200 actually got billed" after a partial failure is far more expensive
than asking the seller to press the button again.

The cost is real and accepted: one bad row blocks a 200-listing batch. If that
becomes a practical problem, the fix is to validate the batch up front and
reject bad ids before the transaction, not to loosen atomicity.

## Not yet done

**`setPublished(id, boolean)`.** `publishProducts()` now owns the publish
direction, but unpublish/archive/draft still set `isActive` and `status` by hand
in several places. One function owning both fields in both directions would make
the desync class impossible rather than merely fixed.

Deferred because it touches every write site at once and was too wide to land in
the middle of the fee work. The sites are `create`, `duplicate`, `createDraft`,
`createDraftForStore`, `updateForStore`, `deleteForStore`, plus the
publish/unpublish/archive bulk action in `admin-products.controller.ts`.
Roughly half a day including tests.

