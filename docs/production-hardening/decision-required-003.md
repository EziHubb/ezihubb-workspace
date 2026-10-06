# D003 — Durable economic operations and activation cutoff

Status: Option A approved by owner on 2026-10-02 ("duyệt, hãy tiếp tục đi"). Repository implementation and isolated verification authorized; not production activation, live provider operations or historical corrections. Implementation remains incomplete.

Problem: R08 loses events between DB commit and queue publication; replay would corrupt R10 stock or duplicate provider fulfillment R12. Provider creation can succeed before local commit. Current inventory does not establish a single product/variant stock authority, especially for manual requests.

Options: (A) additive operation-intent + outbox + unique consumer receipts and inventory reservation/consumption records, activated prospectively at a reviewed cutoff; (B) synchronous retries only; (C) keep online provider workflows disabled. Recommend A after D002 and isolated sandbox proof; use C until then. B is insufficient because no network call can be atomic with PostgreSQL.

Decisions needed: reserve on request vs capture, product vs variant stock ownership, release/expiry rules, digital/mixed order transitions, provider intent retry/reconciliation policy, treatment of already-paid historical orders and sandbox credentials. These affect fulfillment and public checkout behavior; do not infer them from current faulty handlers.

Proposed schema (not created/applied): OutboxEvent unique aggregate/event version with payload containing IDs only; ConsumerReceipt unique consumer/event; PaymentOperation/RefundOperation unique idempotency key and provider IDs; InventoryReservation/Consumption with quantity, product/variant and order line reference; fulfillment intent stores external ID before retryable push. Schema design must include ownership/index/FK rules and retention before migration.

Advantages: eventual delivery and replayable recovery, auditable external ambiguity. Disadvantages: worker complexity and rollout coordination; requires real PG transactions and provider sandbox tests.

Migration: expand only, deploy dormant producers/consumers, validate sandbox crash matrix, activate only new operations at explicit cutoff. Old paid orders are reconciled into exceptions, NOT bulk replayed. No existing migrations edited and no DB commands executed in this pass.

Rollback: stop dispatch/new economic operations, retain intents/outbox/receipts for reconciliation, drain only safe consumers. Never simply rerun provider create after timeout.

Risk if postponed: lost fulfillment, duplicate credits or stock decrements, oversell, unpaid orders becoming shipped and permanently divergent provider/DB state.
