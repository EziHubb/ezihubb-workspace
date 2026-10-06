# D002/D003 next implementation boundary — 2026-10-03

Design review; implementation of M1–M2 started after the owner's “chốt” on 2026-10-03. NOT activated. The five-action plan and its defaults are approved; no historical correction or live provider operation is authorized. This document preserves the dependency between economic authority, replay safety and public balance contracts.

## Revalidated call sites

- `orders/orders.service.ts`: online checkout creates SALE/fee ledger rows and seller earnings before capture. Manual order requests already record zero earnings; do not regress that separation.
- `finances/finances.service.ts:getOverview`: all `SellerLedgerEntry` rows without payoutId count as current available money, pending is always zero. An unpaid-row filter at checkout alone would strand credits because capture handlers do not yet create the replacement settlement.
- `stores/store-orders.service.ts:requestPayout`: batches unallocated ledger rows. Its serializable transaction is useful but does not establish captured-money provenance.
- `affiliates/admin-affiliates.service.ts:markPayoutPaid`: marks all confirmed commissions paid even for partial payout. Balance CAS is not immutable allocation.
- `affiliates/commission.service.ts:cancelCommission`: a partially reserved/paid commission cannot be reversed safely without knowing its payout allocation and remaining debt.
- `orders/order-ledger-reversal.ts`: append-only full cancellation reversal is not provider refund evidence or a partial-quantity refund allocator.

## Prospective authority model

1. Order creation snapshots quoted lines, discounts, customer shipping, platform-funded amounts, currency and fee policy version. Quotes are not withdrawable ledger credits. Manual requests remain uncollected until a separately evidenced collection exists.
2. A durable payment operation records the intent/idempotency key before the provider call. Ambiguous timeouts reconcile the same operation; they never issue an unrelated second charge.
3. A verified capture produces immutable capture-to-store allocations, captures seller proceeds/fees and an outbox event in one database transaction. Unique provider capture identity prevents duplicate economic booking. Parent order total is never attributed wholesale to each shop.
4. Balance reads and payout reservation use the same captured/eligible allocation authority. Display pending/reserved/available/debt separately. Do not use an unversioned historical ledger sum as evidence of captured funds.
5. Every payout reserves exact allocation amounts; partial payouts may span or partially consume multiple entries. Mark-paid cannot update unrelated commissions. Provider transfer evidence is distinct from an admin status label.
6. Refund operations reference original captured allocations and refunded quantities. Round per currency with deterministic remainder allocation; cumulative refund cannot exceed captured refundable amount. Reversal entries preserve original settlement and post-payout debt, rather than deleting paid rows.
7. Dispatcher/consumer receipts and inventory mutations must be atomic before any event replay is activated. Existing paid orders are not automatically replayed into stock or fulfillment.

## Accounting constraints and cases

| Case | Required invariant |
|---|---|
| Unpaid/failed online or manual request | No available seller/affiliate credit, no payout eligibility |
| Multi-shop capture | Allocated customer funds plus explicit platform funding reconcile to receivable/settlement; no duplicated parent totals |
| Platform-funded coupon/free shipping | Funding source and beneficiary explicit; subsidized shipping does not become seller shipping credit under the owner's prior rule |
| Duplicate capture/webhook | One capture record, one allocation set, one consumer effect |
| Partial affiliate payout | Reserved sum equals payout amount; untouched commissions remain untouched; fully paid only when their own allocation is fully settled |
| Cancel vs payout reservation | Conflict is visible/retryable; cannot pay a cancelled entitlement or silently debit it twice |
| Partial refund after payout | Original payout remains, compensating debt references refunded allocation and provider refund |
| Legacy records without provenance | UNKNOWN/reconciliation exception; no automatic backfill, reset or inferred payment proof |

Amounts must use integer minor units or Decimal end-to-end, not JS floating point accumulation. Allocations carry currency. Tests must cover quantity greater than one, remainder cents, mixed store/coupon/subsidy, competing payout/refund/confirm/cancel and provider success followed by DB/queue failure.

## Remaining policy/activation inputs

- Approved 2026-10-03: proportional reversal of original order-linked platform fees and affiliate commission for refunded merchandise; listing fees excluded. Provider fees/tax require actual evidence, otherwise reconciliation. Paid-out reversals become debt, not deletion or external debits.
- Cash capture vs order confirmation remains strict: confirmed manual request is not capture. No manual fake-capture button introduced.
- Approved shipping/stock rules are in next-five-actions-approval-plan.md: full shop cancellation before handoff refunds customer-paid shipping; other shipping refunds need explicit approval. Online reservation TTL defaults to 15 minutes. PG product shared pool versus variant pool is snapshotted from quantity settings; unlimited does not decrement stock. No automatic stock hold or revenue from manual requests.
- Historical allocation/debt correction, deployment cutoff, staging provider access and live activation are separate approvals. New schemas must be additive, no destructive migrations.

Update 2026-10-04: M3 quote/capture/allocation/journal, durable provider creation and captured balance/exact payout APIs now exist and are registered; no rollout flags were enabled by this work (default disabled, external configuration not inspected). See economic-balance-payout-contract.md for the current boundary and economic-capture-contract.md for the earlier M3a snapshot. Legacy API/UI authority switching, checkout provider choice, refund/recovery, versioned consumers and server/provider failure evidence remain open. Do not ship only one of those readers/producers. Earlier call-site observations above are baseline evidence, not claims that the removed pre-capture checkout credits still exist in current code.
