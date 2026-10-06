# M3a — immutable quote and verified capture contract

Historical M3a checkpoint, 2026-10-04. **Superseded integration boundary:** see [economic-balance-payout-contract.md](economic-balance-payout-contract.md) for the later registered checkout/callback/balance/payout implementation. The dormant/unregistered and open-implementation statements below describe M3a only. M3 is still incomplete; no external provider calls or external database migrations were made, and no rollout flag was enabled.

## Implemented boundary

1. `economic-quote.ts` builds a canonical, PII-minimized snapshot of per-shop lines, quantity, seller/platform discounts, customer-paid shipping, expected shipping subsidy, gift wrap, supplied fee/tax rules and affiliate rate/lock policy. Money uses canonical integer strings/BigInt. Stable JSON hashing survives PostgreSQL JSONB key ordering. Rebuilding the quote rejects inconsistent derived totals/parts.
2. `persistEconomicQuote` checks original order/line/shop identity and unit prices, total, new unpaid status, provenance and absence of old order-linked ledger credits. Existing contexts cannot be overwritten. This helper is not a historical backfill path.
3. Server-configured read-only evidence readers retrieve Stripe PaymentIntent + expanded charge, or a PayPal capture, outside the DB transaction. Validate provider account, TEST/LIVE scope, provider payment identity, successful/full capture, amount, currency and quote/operation metadata. Stripe refunded/disputed observations go to reconciliation. Missing PayPal linkage/merchant/final-capture fields fail closed.
4. In one SERIALIZABLE transaction, recheck quote and payment binding, claim the same dispatched operation, write capture + per-part allocation + balanced journal, mark Payment paid and append a reference-only outbox event. Unique identities/immutable evidence prevent a second booking. Outbox failure rolls the booking back. This is not an atomic transaction with the external provider.
5. Capture does NOT confirm orders, consume inventory, clear carts, credit the legacy ledger, make affiliate balances eligible, dispatch jobs or initiate fulfillment. These require coordinated versioned consumers and readers.

## Journal semantics

Positive values are debits, negative values are credits. Each capture journal sums to zero in its own currency.

| Account | Capture meaning |
|---|---|
| CUSTOMER_FUNDS | Verified amount captured from the customer |
| PLATFORM_PROMOTION | Explicit platform-funded merchandise discount; not quoted free-shipping support |
| SELLER_PAYABLE | Per-shop gross credit minus original order-linked seller fees |
| PLATFORM_FEES | Seller fee revenue excluding VAT |
| TAX_PAYABLE | Customer tax plus VAT on seller fees; not platform revenue |
| PLATFORM_AFFILIATE_COST / AFFILIATE_PENDING | Explicit platform-funded affiliate liability, not yet payout-eligible |

Expected shipping subsidy remains in the quote for reconciliation; it is neither provider expense evidence nor seller shipping credit. Provider cost remains `UNRECONCILED`, not an invented zero.

Fee inputs are internal authoritative amounts, not buyer DTOs or a replacement pricing engine. Supported order fees: transaction, payment processing, regulatory and VAT. Listing, offsite marketing and share-save cannot be silently treated as generic fee revenue. Unsupported tender/beneficiary cases fail closed until explicit contracts exist.

## SQL protections and isolated verification

`20261003100000_economic_capture_allocations` adds three tables, one enum, indexes/FKs, immutable row triggers, a provider/context identity trigger and deferred conservation triggers. The deferred guards require complete allocations and the canonical journal at COMMIT: exact original part fields/fees, each shop's net liability, currency, account, beneficiary and entry identity. A balanced but misclassified tax/affiliate entry or an offsetting bogus pair is rejected.

`apps/api/test/economic-migrations.sql-check.ts` runs both economic migrations on fresh in-memory PGlite using the real earlier NanoID SQL function and a minimal synthetic Order table. Eleven SQL cases cover:

- Quote immutability, order deletion FK, amount/mode checks.
- Dispatch evidence and refusal to reset an ambiguous operation for blind retry.
- Valid capture commit, generated NanoID 12 and immutable evidence.
- Deferred unbalanced-journal rejection, atomic rollback and retry.
- Missing journal, foreign shop allocation and offsetting bogus journal entries.
- Multi-shop quantity/discount/funding/shipping/wrap/VAT/affiliate fixture; wrong account/affiliate rejection.
- Wrong provider account capture rejection.
- Receipt plus an actual synthetic DB effect: rollback together, retry once, duplicate no-op.
- Reservation pool/quantity immutability, consumed-state protection.
- Duplicate request/capture identity rejection.
- Lease token fencing, state shape and immutable terminal outbox records.

The normal Nx API Jest target invokes this Node subprocess so PGlite's WASM loader does not run inside Jest's VM. It uses no DSN, external DB or credentials. This is actual PostgreSQL SQL/trigger execution, NOT a networked PostgreSQL/Prisma integration, full historical migration-chain test, multi-session contention/failover test or provider sandbox evidence. The Jest wrapper is one test containing eleven Node SQL cases; do not sum them as separate Jest tests.

Pure/model tests cover canonical quote arithmetic and metadata, provider mismatch rejection, configured reader destinations/timeouts, transactional booking/replay/outbox rollback and payment binding changes during the provider read. Final command results are recorded in `progress.md`.

## Open integration obligations

- Finish new checkout/payment operation creation and deterministic fee/tax/funding sources. Existing online checkout still credits legacy seller rows before capture; no claim R07 is fixed in production.
- Handle mixed/gift-card tenders explicitly. Existing small residual tender logic needs review; new capture code rejects split/gift-card payments rather than forgiving a residual. Zero-cash orders need a separately evidenced funding path, not a fake provider capture.
- Bind Stripe creation metadata and PayPal purchase-unit custom/invoice IDs before capture. Verify real sandbox payloads and credentials/mode/account routing. Current Stripe reader supports platform charges only; Connect needs an explicit account model. Bound PayPal token acquisition in its eventual caller.
- Implement captured balance, holds/reservations/debt, exact seller/affiliate payout allocations and evidenced transfers together. This journal is not an available-balance API.
- Add refund evidence/compensating journals, late stock reacquisition, durable fulfillment, bounded Serializable retries and reconciliation scheduling/UI.
- Prove real multi-session DB races, provider/DB/queue failure recovery, complete migration deployment, restore and browser/tenant behavior before activation.

## Rollout / recovery

All three pending guest/economic migrations remain unapplied to external environments. Economic migrations were executed only in disposable memory during tests. No historical rows were reclassified or repaired. Deploy/commit/push, external migrations, sandbox credentials and live money still require their separate authorized boundaries.

Do not deploy a capture producer independently of new balance/payout/stock/fulfillment routing. Once versioned financial evidence exists, recovery freezes affected writes/dispatch/payout and reconciles the same operation. Never drop immutable tables, replay legacy paid orders wholesale or fall back to legacy balance sums for versioned orders.

## Primary references consulted

- [Stripe PaymentIntent API](https://docs.stripe.com/api/payment_intents): authoritative payment status and expanded charge evidence.
- [PayPal Payments v2](https://developer.paypal.com/api/payments/v2): captured payment details and merchant/payment linkage.
- [PGlite API](https://pglite.dev/docs/api): isolated in-memory PostgreSQL query/transaction execution; this does not supply multi-session server proof.
