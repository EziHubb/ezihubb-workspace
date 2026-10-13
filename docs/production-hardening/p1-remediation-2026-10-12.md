# P1 remediation — 2026-10-12

Scope: the four P1 groups from the October 12 rescan. No UI restyling,
historical financial correction, provider activation or production mutation.

## Gift-card boundary

The apply endpoint uses the existing `OrderPayerService` rule: an account order
requires its owner; a genuinely anonymous order uses its opaque ID. Its body is
validated. Both intent creation and apply reject expired/empty cards; the atomic
debit also checks active state and expiry. Card-only completion locks the order
and rejects a changed state or an already-bound payment.

Partial apply now returns a **quote**, without spending a card. The caller must
pass `giftCardCode` to `create-intent`; the saved split is debited at verified
payment completion. This is not a reservation of the quoted card balance, and
is not sandbox acceptance of legacy mixed-tender recovery. A remainder below
Stripe's minimum is rejected, never falsely treated as paid. Amount calculations
use cents. Historical `GiftCardUsage` on a still-pending order blocks further
apply/intent calls for audited reconciliation; no history is relabelled or refunded.

## Link previews

Public-address validation fails closed for mapped/compatible/tunnel IPv6,
non-public IPv4 and mixed DNS answers. The HTTP(S) socket connects to the checked
literal IP, preserving original Host and HTTPS SNI/certificate validation. Each
redirect is rechecked. One deadline covers DNS, headers, redirects and response
body; retained body bytes are capped. Thread authorization remains before cache
and networking. Automated transport tests use mocked DNS/sockets, not outbound
connections to cloud metadata or private networks.

## Durable queue handoff

Additive migration `20261012130000_order_event_outbox` creates a reference-only
`OrderEventOutbox`, with unique `(eventType, orderId)` and nanoID(12) defaults.
Stripe, direct/webhook PayPal and card-only legacy completion write `ORDER_PAID`
in their state transaction. Authenticated tracking writes `ORDER_DELIVERED` in
the delivery/receipt transaction. A failed intent insert rolls the transition
back. No email, webhook payload, amount or credentials are stored in this table.

The dispatcher reads only prospective pending intents, claims fenced leases,
hands off to existing queues and acknowledges only after queue acceptance.
Redis failure retains pending work; a process crash leaves a recoverable lease.
Provider callbacks kick the dispatcher without waiting for its Redis scan.
`DISABLE_QUEUE=true` never acknowledges no-op queues. Legacy paid consumers are
not dispatched into versioned economic contexts. Removed/closed orders are
marked skipped. Duplicate callbacks drain existing work, not historical orders.

Event/subscriber/delivery jobs retain deterministic IDs, including terminal
jobs, to protect retries after queue acceptance but before DB acknowledgement.
Do not automatically purge these IDs: monitor Redis memory and design a
separately reviewed receipt/retention policy before pruning. Worker exhaustion
still requires manual recovery/alerts. This closes the DB-commit/queue-enqueue
gap, not all end-to-end effects: SMTP acceptance is not mailbox delivery, and
Redis data loss, downstream retry exhaustion and native concurrent provider
settlement remain separate acceptance boundaries. No exactly-once delivery claim.

## Rollout and verification boundary

Apply the additive migration **before** restarting producers/dispatcher. This
turn does not apply it externally or deploy. Unit models and disposable WASM
PostgreSQL chain/uniqueness/rollback tests are not native PostgreSQL/provider
acceptance. Existing P2 dependency/schema-drift/label/logging issues remain;
M5 remains NO-GO. Existing rollout flags and legacy historical data stay intact.

## Local verification

- `pnpm nx run api:test --skipNxCache --runInBand`: 95 suites / 984 tests passed.
- `pnpm nx run-many -t lint typecheck build -p api --skipNxCache`: passed;
  lint has 175 existing warnings and zero errors.
- `pnpm nx run api:m5-test`: 46 tests passed, including the additive migration
  chain, outbox uniqueness/defaults and delivery-receipt/outbox rollback.
- `pnpm exec prisma generate` and `git diff --check`: passed.

Local Node is 24.14.0, below the repository's >=24.15.0 <25 engine range;
the engine requirement was not relaxed. Provider sandbox/native PostgreSQL,
real Redis deduplication, SMTP and authenticated production flows were not
executed by these checks. No commit, push or deployment was performed.
