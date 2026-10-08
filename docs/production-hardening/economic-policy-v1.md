# Economic policy v1 — approved 2026-10-03

Version: `2026-10-03.v1`. Owner approved the five-action plan with “chốt”.
This is a prospective contract, not a live feature or proof of collected money.

Implementation update — 2026-10-08: later M3/M4 extensions now register guarded
checkout/capture, refund evidence and settlement/debt, a disabled dispatcher,
original stock expiry/reacquisition, audited DEAD database recovery, shared manual
fulfillment gates and scoped reports. Earlier "not implemented/imported" statements
below describe their foundation checkpoint, not the current source. See
`m4-closeout.md` for final M4 local acceptance and the M5 handoff, and
`m4-implementation.md` for implementation details. No provider or
production activation occurred. DB-only recovery never resends external effects.
Gift-wrap refund is now implemented only with separate platform SUPER_ADMIN
approval, as recorded in the owner-approved addendum below. Automatic eligible
shipping refunds and separately approved shipping exceptions are integrated,
as is original-resource recovery for supported Printify contracts. Tax-bearing
refunds and unsupported providers remain blocked/manual, not certified features.
M4 repository implementation is CLOSED; operational release is not. Multi-session PostgreSQL
verification remains SKIPPED at owner request, not passed.

Checkout creation extension — 2026-10-08: a required opaque client request key is
hashed with the authenticated account or guest cart cookie. Its original payload
hash and response are recorded atomically with the prospective order. Changed
payloads, closed/deleted orders and cloned original baskets fail closed. A minimal
immutable receipt survives authorized deletion of a non-financial order; no
personal contact details or raw cart-cookie/key is stored in this receipt.
Read-only recovery never authorizes capture or refund. Public capability metadata
does not enable any rollout flag. Apply the additive checkout-request migration
before a coordinated client/API release; legacy clients without identities are
rejected rather than creating unprotected orders. Browser-storage failure is not
consent and does not grant analytics permission. See the current M4 boundary.

## Money and conservation

- Exact integer minor units internally; decimal strings in JSON; currency and exponent explicitly snapshotted. No automatic FX. SQL operation amounts are positive signed BIGINT values; API boundaries must reject overflow before writing.
- Allocate proportional totals by largest remainder, breaking ties by immutable line ID in ordinal order. Input permutation cannot change which line receives a residual unit.
- Unit refunds use cumulative floor differences: `floor(originalAllocation * (previousUnits + addedUnits) / quantity) - floor(originalAllocation * previousUnits / quantity)`. Apply independently to original merchandise/fee/commission allocations, never current rates. The final unit reverses the final remainder. This helper covers quantity refunds, not arbitrary goodwill/amount refunds; those need explicit original-allocation caps in M4.
- Seller-funded discounts reduce seller gross. Platform-funded merchandise discounts have an explicit funding allocation and do not silently reduce seller gross. Customer payable plus platform merchandise funding equals seller gross before order-linked fees/other separately evidenced recipients.
- Customer-paid shipping is seller shipping credit under the existing rule. Platform shipping subsidy is expected support, NOT seller credit and NOT actual shipping spend. Tax/provider fees and actual shipping spend require evidence; do not replace unknown amounts with zero in settlement.
- Seller available funds require verified capture, minus fees, applicable holds/reservations and debt; no additional delivery hold. Affiliate eligibility also requires delivery and the snapshotted existing lockDays. Listing fees are not automatically refunded. Post-payout refunds produce debt, not deletion or external debits.

### Concrete USD fixture

| Component (minor units) | Shop A: quantity 2 | Shop B: quantity 3 | Total |
|---|---:|---:|---:|
| Merchandise | 4498 | 9000 | 13498 |
| Seller discount | 498 | 0 | 498 |
| Platform merchandise discount | 500 | 501 | 1001 |
| Buyer payable | 3500 | 8499 | 11999 |
| Seller gross before fees | 4000 | 9000 | 13000 |
| Customer shipping / seller shipping credit | 0 | 0 | 0 |
| Expected platform shipping support | 500 | 750 | 1250 |

Conservation: `11999 + 1001 = 13000`. The extra `1250` is NOT booked as a capture, seller balance or spent shipping money. A 100-cent allocation refunded in three single-unit refunds reverses `33 + 33 + 34`, exactly 100 cents.

## State machines and commit boundaries

| Record | Allowed progression | Boundary / retry rule |
|---|---|---|
| Payment operation | PREPARED → DISPATCHED → SUCCEEDED / FAILED / NEEDS_RECONCILIATION | Intent commits before provider call. Provider calls stay outside DB transactions. |
| Ambiguous operation | NEEDS_RECONCILIATION → SUCCEEDED / FAILED | Inspect same provider operation; never reset to PREPARED or invent a new key. Terminal evidence is immutable. |
| Captured settlement (M3) | Verified provider evidence → capture + allocations + ledger + outbox | One DB transaction; verification includes amount, currency, account, mode and original order context. Not implemented by the primitive claim helper. |
| Outbox | PENDING → CLAIMED → PUBLISHED / PENDING / DEAD | 30-second fenced lease; at most 5 attempts. Expired final lease becomes DEAD. No background dispatcher activated. |
| Consumer | absent receipt → receipt + DB effects | Same transaction; failure rolls both back. Delivery can repeat, effects cannot. A separate external effect needs its own operation/outbox. |
| Inventory | absent → HELD → CONSUMED / RELEASED / EXPIRED | Group all lines sharing a pool, conditional decrement, reservation insert in SERIALIZABLE transaction. Consumption does not debit again. |
| Late capture (M4) | expired/released stock → atomic reacquisition or reconciliation/refund | Current foundation rejects late consumption. Full reacquisition and fulfillment blocking workflow must be integrated before activation. |
| Seller/affiliate payout (M3) | eligible allocation → reserved → evidenced paid / released | Exact immutable allocations; pay/reject races cannot affect unrelated credits. |
| Refund (M4) | original capture/allocation → durable request → evidenced reversal/debt | Cancellation is not proof of refund, and refund is not restock evidence. |

Refund shipping: full shop cancellation before handoff returns remaining customer-paid shipping. Partial/after handoff defaults to zero; explicit SUPER_ADMIN override requires amount, actor, reason and evidence, bounded by remaining collected shipping. The final M4 integration enforces platform controller authorization, durable authenticated approval and independent SQL bounds. Approval references are not provider settlement proof.

### Approved gift-wrap refund addendum — 2026-10-08

Owner decision: “Chỉ hoàn phí gói quà khi super admin duyệt riêng”. This replaces
the proposed automatic full-shop/pre-packing rule; it was not approved. No
automatic gift-wrap refund on cancellation, returned merchandise or packing state.

Each original-allocation refund selecting GIFT_WRAP requires explicit platform
SUPER_ADMIN approval, a required reason and the authenticated actor. Store them
immutably in `giftWrapApproval` with policy
`2026-10-08.gift-wrap-explicit-approval.v1`. No caller-supplied actor, proof or
discretionary refund amount is accepted. Bound it to the original collected
gift-wrap allocation and remaining quantity (one charge per shop); a zero,
missing or already refunded allocation cannot create an additional refund.
Gift-wrap has no merchandise affiliate reversal. Preserve original seller/fee
allocations, compensating journal, debt rules and payout evidence.

The UI control is unchecked by default and separate from the two-step
prepare/execute confirmations. Preparation is not refunded money. Completion
still needs independent provider verification. SQL checks the frozen approval
against the request actor/reason and rejects invented amounts or history.
Normal merchandise plans retain their existing hashes/contracts. This is local,
prospective implementation behind disabled gates, not activation or migration
of financial history; unsupported tax-bearing refunds remain blocked.

### Approved refund rounding addendum — 2026-10-08

Refund plans snapshot `2026-10-08.platform-rounding.v1`; the original quote and
its `2026-10-03.v1` policy are not rewritten. Independently reverse each original
customer/funding/gross/net/fee-component/affiliate allocation using cumulative
quantity floors. Never change the buyer refund or a beneficiary amount to force
one partial refund to balance.

For a partial item reversal, record signed differences in minor units:

- Funding: customer + platform funding − seller gross (absolute bound 1).
- Beneficiary: seller gross − seller net − total seller fee (absolute bound 1).
- Fee: total seller fee − sum of original fee components (absolute bound
  number of fee components − 1, minimum 0).
- Platform rounding: sum of these three differences. Positive planned journal
  entries are platform debits; negative entries are credits. No discretionary
  amount or account substitution is allowed.

Example: quantity 3, customer/seller gross 300, original seller net 298,
transaction fee 1 and VAT 1. Three single-unit refunds preserve seller net
99 + 99 + 100, both fees exactly 1, and customer 100 + 100 + 100. Separate
platform rounding is +1, +1, −2; total is 0 when fully reversed. Grouped refunds
must reach the same original totals. Affiliate shares retain the original
largest-remainder split and original recipient, not current commission rules.

The immutable request stores its plan, planned balanced journal and signed total.
SQL independently verifies original components, bounded signed differences,
affiliate allocation and exact journal identities, not just a zero total. This
checkpoint **does not book an actual refund/expense, debit seller balances or
change paid evidence**. Booking requires provider-verified completion and atomic
debt/ledger integration. Tax-bearing, shipping/gift-wrap and arbitrary amount
refunds remain fail-closed; listing fee policy is unchanged.

Multi-session PostgreSQL verification is skipped for this iteration at the
owner's request, not passed. Isolated PGlite SQL execution is not contention or
Prisma/networked PostgreSQL proof and does not permit production activation.

## Inventory authority and recovery

### Current M4 shipping and external-effect boundary (2026-10-08)

The earlier dormant/preparation-only statements describe their dated checkpoints.
Original customer-paid shipping refunds now require cancellation of the whole
shop before handoff and complete original item refunds (including settled prior
quantities). Tracking, parent shipment history and any legacy or versioned POD
intent block the automatic rule. API and SQL verify eligibility independently.
Platform shipping support is neither customer-paid shipping nor seller credit.
Separate explicit SUPER_ADMIN gift-wrap approval is unchanged. The original
approved shipping exception is now integrated for a positive exact amount on
one original SHIPPING charge. Actor/reason/evidence and prior settled shipping
are frozen; cumulative component floors cap reversal at original collected money.
After a partial exception, another separate approval is required for the remainder;
normal whole-charge refunds cannot refund it twice. Merchandise quantities remain
independent. Tax-bearing/goodwill refunds remain unsupported and fail closed.

Prospective external intents have frozen payloads and a one-way dispatch claim.
Unknown POD results use independent original Printify resource reads, never a
second POST. Current support is fully mapped unpersonalized LIVE Printify only;
other providers and artwork remain manual. Creation proof cannot authorize a
production/shipping status, cancellation write or actual-cost booking.
Transactional notifications follow original lifecycle proof; TEST never contacts
buyers. SMTP acknowledgement records acceptance, not inbox delivery, and timeout
never resets a send for retry. Separate activation gates remain false. See
`m4-implementation.md` for exact coverage and unperformed verification gates.

- Quantity-varying enabled variants use `ProductVariant.quantity`, otherwise tracked products use `Product.quantity`; explicitly untracked products use UNLIMITED receipts. Null/negative quantities in a finite pool fail closed.
- Snapshots persist pool kind, product/variant identifiers, grouped line IDs/quantities and original expiry. Retry does not extend expiry or switch pools after catalog edits. Default TTL 900 seconds, primitive accepts an explicit 1–86400-second value; platform-settings UI/wiring is not yet implemented.
- Reservation methods are dormant primitives, not checkout authorization. Manual requests must not call them until an audited acceptance step is implemented. TEST contexts must only use isolated test catalogs/providers; no public request may select provenance.
- If a referenced pool is removed, becomes null or would overflow, release fails and its transaction rolls back. An operator reconciliation flow must resolve it; never silently lose held stock. Snapshot identifiers deliberately survive catalog removal rather than cascading evidence away.
- SERIALIZABLE failures require bounded retries of DB-only operations with the same identity. This caller-level retry/reconciliation scheduling is still part of M3/M4.
- Existing low-stock/fulfillment consumers must not run in parallel for versioned orders. No replay of historical paid orders and no expiry worker until this routing is integrated.

## Implementation boundary

Implemented locally: pure money/refund/shipping rules, additive context/operation/outbox/receipt/reservation schema, operation claims/quarantine, reference-only outbox append, fenced publish retry contracts, transactional consumer receipts, reserve/consume/release primitives and targeted tests.

Update 2026-10-04: immutable quote builder, read-only capture evidence adapters, capture/part-allocation/journal schema and atomic booking helpers now exist (M3a), still dormant. Refund adapters, balance/payout/debt tables/readers, actual dispatcher/reconciliation scheduler, full late capture reacquisition, provider/manual acceptance integration and reconciliation UI remain open. See economic-capture-contract.md. No Nest module/controller/scheduler imports these primitives. The five-step mission remains open and live economic authority is unchanged.

## Migration / verification

`20261003090000_economic_durable_foundation` creates five tables and seven enums only; adds indexes/FKs/checks/immutability triggers without financial backfill. Order context is optional and has no legacy default. Its FK restricts deletion of an order after new financial evidence is attached. SQL guards are additional to Prisma schema and must be retained during subsequent migrations.

Update 2026-10-04: the foundation and new capture migrations now run in disposable in-memory PostgreSQL tests with real SQL checks/triggers and rollback assertions. They and the earlier guest-message migration remain unapplied to any external database. Prisma schema/codegen checks and PGlite SQL cases are not networked Prisma integration, multi-session transaction-contention or provider-sandbox proof. Before rollout, verify the complete migration chain and race recovery in an explicitly isolated server environment, then integrate all versioned producers/readers/consumers together. Rollback freezes new writes/dispatch/payout; never drops evidence tables.
