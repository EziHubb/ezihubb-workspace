# Economic policy v1 — approved 2026-10-03

Version: `2026-10-03.v1`. Owner approved the five-action plan with “chốt”.
This is a prospective contract, not a live feature or proof of collected money.

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

Refund shipping: full shop cancellation before handoff returns remaining customer-paid shipping. Partial/after handoff defaults to zero; explicit SUPER_ADMIN override requires amount, actor, reason and evidence, bounded by remaining collected shipping. The pure helper validates audit references and bounds; controller authorization remains required when integrated.

## Inventory authority and recovery

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
