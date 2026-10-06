# Recovery and reconciliation runbook — design, not an executed drill

No production credentials, provider operations, external DB migrations or job replay performed. D001–D004 and the five-action implementation plan are approved. Economic migrations now run on disposable in-memory PostgreSQL only; networked DB/provider/recovery drills remain unperformed. Confirm the exact isolated environment before external migrations/failure injection. Do not replay production ORDER_PAID: current inventory has no integrated durable consumption marker.

## Money trace and invariants to reconcile

For each provider transaction, retain provider ID, currency, captured/refunded cents, Payment ID, Order ID, StoreOrder IDs, seller ledger entry IDs and payout/allocation IDs. Observed chain today:

`Checkout -> Order/StoreOrder -> sale ledger [online, before capture] -> Payment -> provider callback -> PAID -> queue fanout`

`Ledger entries with payoutId null -> available balance -> SellerPayout allocation -> admin marks paid`

The second chain does not prove an external transfer; a PAID label is not settlement evidence. Proposed corrected chain requires D002/D003:

`Provider capture -> committed Payment + per-shop allocation + outbox -> deduplicated ledger/stock consumers -> eligible balance -> reserved allocation -> external transfer evidence -> settled payout`

Reverse trace must join `RefundOperation -> provider refund ID -> Payment adjustment -> each StoreOrder/line allocation -> immutable ledger adjustment -> available/reserved/settled payout liability`. Refunds after settlement create a traceable debt/adjustment, never erase the settled payout.

Read-only reconciliation report design: one row per mismatch, with IDs and amounts but no email/address/token. Categories: capture without Payment; PAID without provider capture; captured Order missing shop confirmation; unbacked sale credit; refund without ledger reversal; ledger reversal without provider refund; payout over eligible balance; partial payout with unallocated commissions; negative/missing variant stock; provider fulfillment created but internal ID absent. Do not auto-correct ambiguous rows.

## Sandbox crash matrix

| Boundary | Inject | Required evidence before activation |
|---|---|---|
| Provider accepted / DB unavailable | Stop test DB after capture/refund/create | Durable intent and provider idempotency resolve ambiguity; no second charge/refund/order |
| DB committed / queue unavailable | Stop disposable Redis | Outbox stays pending and is dispatched on recovery |
| Queue accepted / dispatch receipt missing | Kill dispatcher | Re-dispatch does not repeat economic effects |
| Consumer after stock/credit before ack | Kill worker | Consumer receipt + mutation transaction prevents duplicate consumption/credit |
| Two last-unit orders | Parallel real PG transactions | One reservation succeeds; product/variant stock never negative |
| Mixed stores, quantity 3, partial refund | Refund one line/one unit | Sum allocations equals provider amount; other shop unaffected |
| Refund after payout | Record test transfer then refund | Settlement retained; debt reconciles under approved policy |
| Commission confirm/cancel; payout reject/pay | Barrier-synchronized DB transactions | One legal transition and one balance effect; conflict retries visible |
| Invalid/duplicate/out-of-order tracking | Replay signed sandbox fixture | No unauthorized mutation; terminal statuses not resurrected; per-shop attribution correct |
| Moderation budget exhausted/provider timeout | Fail test provider | Content remains pending, failed work visible; deliberate reschedule after budget reset |
| Redis lost | Restart disposable instance | Cache reconnects; security counter policy separately verified; out-of-band alert arrives |

## Observability and operator workflow

- Use generated request IDs and persisted job/provider/operation IDs. HTTP route templates and dead-job metadata now avoid raw URLs, payloads and exception text; other log call sites still need audit.
- Log marker `[DEAD-JOB]` is useful but email alert depends on the same Redis. Configure an independent alert route and prove delivery during Redis failure before pilot.
- Inspect terminal jobs using authorized queue access, never paste raw payloads/PII into incident documents. Job retention is bounded; capture sanitized correlation metadata before expiry.
- On mismatch: freeze affected economic writes, identify exact operation IDs, compare provider sandbox state to immutable internal records, decide manual adjustment through audited authorization. Never delete a Payment/ledger/payout to make totals match.
- Moderation jobs now fail instead of completing as CLEAN on errors/budget exhaustion. Existing retries are finite; exhausted-budget jobs require explicit recovery/rescheduling. A future durable backlog is still required, not claimed implemented.
- EasyPost verification checked against [official HMAC guidance](https://support.easypost.com/hc/en-us/articles/39826034964237-Webhook-HMAC-Validation) and [official Go v1 implementation](https://github.com/EasyPost/easypost-go/blob/master/webhook.go). Current patch accepts v1 prefix and prior bare digest; v2 timestamp freshness, event receipt deduplication and transition guards remain unverified/unimplemented.

## Dormant economic foundations — 2026-10-03

- `EconomicOperation` persists account/provider/mode/idempotency identity before dispatch. Expired or ambiguous DISPATCHED becomes NEEDS_RECONCILIATION, never PREPARED. No provider lookup/dispatch scheduler is registered yet.
- `EconomicOutbox` stores reference-only events. Lease ownership is fenced; five failed attempts or an expired fifth attempt becomes DEAD. PUBLISHED/DEAD records are immutable: future audited recovery must create a separately identified action, not reset terminal evidence silently.
- `EconomicConsumerReceipt` and DB effects share a transaction. External HTTP/payment/mail effects are not made atomic by this receipt and must use separate durable intents/outbox.
- Inventory reservations snapshot their original product/variant/unlimited pool and grouped quantities. Retry does not extend TTL; consume does not subtract twice. Missing/null original pools roll release back and require reconciliation. Late capture is blocked from consumption pending explicit reacquisition/refund integration.
- These are dormant primitives; existing payment/low-stock consumers remain unchanged and no replay/expiry runner is active. Updated 2026-10-04: isolated PostgreSQL constraint/trigger/rollback tests now execute both economic migrations. Networked Prisma concurrency, complete migration chain and provider failure drills remain required.

## Rollout and rollback

Updated 2026-10-04: additive guest-message, `20261003090000_economic_durable_foundation` and `20261003100000_economic_capture_allocations` migrations exist; none applied externally. Both economic migrations execute in fresh in-memory PostgreSQL with real constraint/trigger/deferred rollback tests. Full historic chain, networked Prisma concurrency and provider crash recovery remain unverified. Deploy is NOT performed. Before rollout, coordinate DB expansion, API/worker/client changes and verify legitimate password/MFA/Google flows, per-user drafts, guest mailbox proof and provider signing in isolated staging. Economic quote/capture/journal/operations/receipts/reservations remain dormant until coordinated M3/M4 integration. See economic-capture-contract.md, economic-policy-v1.md, guest-messaging-rollout.md and readiness-contract.md for contracts and limits.

If regressions occur: stop affected entry point/worker, retain records and queue state, rollback only the owned code patch. Do not reset the dirty workspace, edit historical migrations, clear financial tables, or replay old jobs as a recovery shortcut. Restore backups in an isolated environment and reconcile before considering any production restore. RTO/RPO and successful restore drill are UNKNOWN.
