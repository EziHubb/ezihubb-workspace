# M3 continuation — captured balances and exact payout allocations

Updated 2026-10-06. Repository implementation only; **M3 is still in progress**. No commit, deployment, external migration, provider sandbox/live operation or transfer was performed. This supersedes the dormant/unregistered M3a boundary in the earlier capture report, not the paid-pilot release gate.

## Implemented path

- Online checkout requires the explicit economic rollout flag and TEST/LIVE mode. It freezes authoritative order/shop/line prices, fees, seller/platform-funded discounts, shipping and affiliate policy inside the order transaction. It no longer creates legacy sale/fee credits, affiliate conversions or share-save rewards before payment. Manual requests remain uncollected and do not create withdrawable money.
- Durable `PAYMENT_CREATE` and `CAPTURE` intents precede external writes. Provider account/mode and quote metadata are bound to the payment. Stripe and PayPal use stable operation identities; ambiguous creation is quarantined as `NEEDS_RECONCILIATION`, not blindly recreated. External I/O is outside DB transactions.
- Registered versioned callbacks use the same verified capture booking: capture, part allocations, journal, balance lots, Payment and outbox commit together. Duplicate callbacks do not use Redis TTL as financial deduplication. Known early callbacks without a completed local binding remain retriable. PayPal versioned verification failures return 503 rather than being swallowed as HTTP success.
- New seller/affiliate balances read only immutable captured lots, scoped by beneficiary, currency and provenance. They separately report captured, available, pending, held, reserved, paid and debt as integer strings. Legacy/unknown balances are explicitly excluded. No FX conversion is implemented.
- Seller eligibility starts at verified capture, subject to safety holds/reservations/debt; there is no invented 14-day seller hold. Affiliate eligibility uses the captured policy's delivery plus lock days. A completed digital order without delivery evidence is still pending; a trustworthy digital completion consumer remains required.
- Payout requests reserve exact FIFO lot amounts in bounded-retry SERIALIZABLE DB transactions. Partial payout never marks all legacy commissions PAID. Rejection releases only that request's allocations.

## Settlement and timeout safety

`REQUESTED → VERIFYING → PAID`, or `REQUESTED → REJECTED`.

Before provider lookup, persist the transfer provider/account/mode/reference and verification actor/time. A lookup timeout leaves the payout in VERIFYING and its money reserved. It cannot be rejected or rebound to a different reference while external outcome is uncertain. A same-reference retry reads evidence again. Completed and rejected records and payout allocations are immutable.

Only super admin in platform context may verify settlement or reject. The endpoint accepts a lookup reference, **not** buyer/admin-supplied proof, amount or recipient. Stripe transfer / PayPal payout-item evidence must match the original payout amount, currency, recipient, mode and payout metadata. Unique provider transfer identity prevents double use. The API does not initiate transfers or imply that a request moves money. Invalid/ambiguous bound references require future audited reconciliation; there is deliberately no unsafe reset endpoint.

`20261004090000_economic_balance_payout` adds accounts, captured lots, payouts, exact allocations and PAYMENT_CREATE. SQL guards bind lot amounts to captured liabilities, preserve tenant/mode/currency, enforce immutable identities and deferred allocation/counter conservation. No existing rows are backfilled or deleted.

## API contracts

All routes below are relative to the API prefix. Integer money fields are base-10 strings; USD has minorExponent 2. History uses page >= 1 and limit 1–48.

| Route | Scope / behavior |
|---|---|
| `seller/finances/economic/{overview,statement,payouts}` | Authenticated store owner, no buyer-supplied store scope |
| `admin/finances/economic/{overview,statement,payouts}` | Existing own-store admin context; super admin must select their own shop |
| `affiliates/me/economic/{overview,statement,payouts}` | Authenticated active affiliate account |
| POST to the scoped `payouts` route | `amountMinor`, `idempotencyKey`, `currency`, `provenance`; recipient comes from trusted configuration |
| `admin/economic-finances/{overview,statement,payouts}` | Super admin, platform context, explicit kind/beneficiary/currency/provenance; statement optionally filters orderId |
| POST `admin/economic-finances/payouts/:id/reject` | Required reason; only unbound REQUESTED payouts |
| POST `admin/economic-finances/payouts/:id/verify-settlement` | Required reference; read-only provider verification, no transfer creation |

Payout amounts below the current affiliate minimum are rejected (existing default $50); seller service minimum is one cent. Repeated identical request keys return the existing request; conflicting amounts/actor/recipient are rejected.

Overview exposes the authoritative `minimumPayoutMinor`. Payout history exposes `verificationStartedAt` and `verificationStartedBy` alongside processing audit fields, without recipient configuration.

## Admin UI checkpoint — 2026-10-04

- Own-store Payment account now reads the captured APIs, with explicit LIVE/TEST selection and separate available, pending, held, reserved, paid and debt cards. Exact decimal input/display uses BigInt, not floating-point money conversion.
- Seller requests require confirmation. The request identity/amount is persisted before POST and restored after reload in the same tab; ambiguous failures retry the same identity instead of silently creating another request. Storage failure blocks new requests. This is not a claim of cross-tab browser deduplication; server reservation/idempotency guards remain authoritative.
- Platform payout UI explicitly selects seller/affiliate beneficiary and mode. It exposes allocation and verification audit history, request rejection, and read-only provider verification. VERIFYING records offer same-reference retry and no rejection/rebinding. None of these controls initiate transfers.
- Legacy seller payouts remain under reconciliation-only history with their former Mark paid action removed from this page. Legacy monthly statements are labeled unverified. Other legacy API actions and the affiliate portal are **not yet retired/switched**.
- Scope changes remount forms/confirmations and isolate query caches. Loading failures are explicit and never shown as zero funds. Native modal dialogs support Escape; mobile layout and no horizontal page overflow were checked.
- UI skill Quick Reference fallback was approved by the owner's continuation; no Python was installed. A stable toast server snapshot also removes the hydration warning exposed by browser tests.

## Configuration — do not enable yet

No flags or credentials were set by this work. Default behavior remains disabled.

- `ECONOMIC_V1_ENABLED=true` and explicit `ECONOMIC_V1_MODE=TEST|LIVE` are required to create new online economic payments. Existing online-payment enablement remains a separate prerequisite. Keeping these off is necessary but not a substitute for the coordinated release gate.
- Stripe requires matching `STRIPE_SECRET_KEY` mode and `ECONOMIC_STRIPE_ACCOUNT_ID`; the account is checked through the provider. Platform charges only; Connect is not silently supported.
- PayPal requires matching `PAYPAL_MODE=sandbox|live`, client credentials and `ECONOMIC_PAYPAL_MERCHANT_ID`. OAuth and evidence requests are bounded, redirects disabled, and tokens are not shared between accounts/modes. Real sandbox merchant binding is not yet proven.
- `ECONOMIC_PAYOUT_DESTINATIONS` is an operator-managed JSON array of `{kind, beneficiaryId, currency, provenance, provider, providerAccount, destination}`. A missing/ambiguous configuration prevents payout requests. These are verified recipients, not an arbitrary public payout-address form.
- Gift-card/split tender, zero-cash orders and unsupported share-save funding fail closed until their economic contracts are implemented. No gift balance is deducted on this rejected path.

## Verification and remaining boundary

Local coverage includes quote funding, create-before-provider ordering, ambiguous timeout/replay, exact partial payout/rejection, modeled competing reservations, evidence mismatch, tenant/role/DTO HTTP checks, and actual migration SQL constraints in disposable PGlite. The SQL wrapper now executes 15 cases, including VERIFYING timeout/rebinding/counter protection. Counts and completed commands are in `progress.md`.

PGlite is not multi-session PostgreSQL/Prisma contention proof; the reservation concurrency harness serializes modeled transactions. Admin browser coverage now passes 8/8 desktop/mobile checks (27.9s), including two project executions of a pure exact-money test. API/session responses are mocked with a locally signed synthetic route JWT, not full-stack authentication or provider proof. No sandbox settlement, server failover, external migration chain or restore drill is claimed.

**Still inside M3:** payment-method selection (normal checkout currently creates Stripe; an already bound order cannot switch to PayPal), and actual DB concurrency evidence. The admin/affiliate UI and HTTP retirement checkpoint below is not completion of the whole approved contract. The Python prerequisite no longer blocks this UI checkpoint because the owner approved the no-install fallback.

**M4/M5 dependencies before activation:** original-allocation refunds/debt/reconciliation, versioned order/inventory/fulfillment consumers, all report/test-provenance filters, creation-timeout recovery, delivery/affiliate conversion attribution, isolated provider/failure/restore drills. Capture does not yet advance order lifecycle, consume stock, clear the online cart or dispatch legacy paid jobs. Signed provider adjustments hold lots for reconciliation rather than guessing a refund. Legacy reads/internal helpers remain; the five HTTP mutation paths are now retired and historical reporting is not verified captured authority.

## Affiliate and legacy HTTP retirement checkpoint — 2026-10-06

- Affiliate payout requests now use captured balances, authoritative minimum, verified recipient configuration, exact minor units, explicit LIVE/TEST scope and confirmation. Same-tab pending request identity/amount survives timeout/reload. The previous fixed $50 minimum / 14-day assumptions and editable payout destination are absent from the new form.
- Affiliate dashboard/sidebar and admin affiliate balances identify historical money as unreconciled rather than available. Legacy seller overview explicitly returns `LEGACY_UNKNOWN`, `includedInAvailable: false`, `requiresReconciliation: true`, `hasFundsReadyForDeposit: false` even for a positive ledger total. Historical rows are not rewritten.
- Admin affiliate payouts now uses the captured platform panel and read-only historical list. Existing seller-request, seller-mark-paid, affiliate-request, affiliate-mark-paid and affiliate-reject HTTP routes return 410 `ERR_LEGACY_PAYOUT_RETIRED` after existing authentication/role gates; GET history remains available. Old service helpers remain for historical regression coverage but have no reachable HTTP mutation through these routes. Pending legacy records need audited reconciliation, not automatic conversion.
- Shared exact USD parsing/formatting is used by both apps. Modal focus is restored after closing. UI skill Quick Reference guidance informs keyboard/focus, state isolation and mobile reflow. New affiliate form copy covers English/Vietnamese; other locales currently fall back to English.
- Mocked browser verification: affiliate 4/4 (29.7s); admin 8/8 (30.4s). The first affiliate run had an ambiguous dialog selector matching cookie settings; the corrected selector names the payout confirmation without weakening behavior assertions. Full API/typecheck/lint evidence is recorded in progress.md.
- No deployment, external migration, provider request, transfer or historical financial correction performed. Rollout remains off.

Do not deploy only this producer. Preserve all historic records and evidence; rollback freezes new writes/dispatch and reconciles existing operations rather than falling back to legacy sums.

## Primary provider references

- [Stripe PaymentIntent creation](https://docs.stripe.com/api/payment_intents/create)
- [Stripe transfer evidence](https://docs.stripe.com/api/transfers/object)
- [PayPal Orders v2](https://developer.paypal.com/api/orders/v2)
- [PayPal payout schema](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/payments_payouts_batch_v1.json)
