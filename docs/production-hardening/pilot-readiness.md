# Pilot readiness — updated 2026-10-06

## Verdict: NOT READY

This is a verdict for the requested controlled paid pilot, not a prohibition on isolated developer tests. Local negative tests and code hardening do not justify moving real money or exposing real buyer data. No live revenue, provider operations, production deployment, restore or reconciliation drill was verified.

| Subsystem | Independent assessment | Required before pilot |
|---|---|---|
| Identity | Uniform Google/password MFA, transactional refresh rotation and mailbox-proven guest capabilities implemented locally | D001 real DB/Redis/Google/mail/browser-cookie integration, durable challenge retention and historical ownership review |
| Authorization | Current DB role enforcement and private draft scoping improved | Cross-account HTTP/browser probes and route-level coverage |
| Tenant isolation | Existing product/store guard changes preserved and regression-tested where available | Seller A/B mutation/read matrix across orders, messages, finance, reports |
| Checkout | Server pricing/manual flow exists; online economic/stock chain unresolved | Multi-store quantity/discount/shipping/payment fixture reconciles |
| Payments | Versioned checkout/provider creation/capture callbacks registered behind rollout controls; no activation | Finish checkout provider choice, M4 consumers/recovery and sandbox duplicate/lost webhook drills |
| Ledger | Immutable captured journal/lots with SQL conservation; pre-capture checkout legacy credits removed locally | Switch all coordinated balance/payout readers and report filters with explicit legacy separation |
| Refunds | Provider and per-shop economic reversals disconnected | Partial/refund retry/post-settlement reconciliation |
| Seller balance | Own-store admin and affiliate payout UI use captured/held/pending/reserved/paid/debt API with exact money and isolated TEST/LIVE states; legacy overview is not withdrawable | Real DB contention tests and remaining historical report boundaries |
| Payout | Exact v1 lot allocations, reserved VERIFYING state, read-only transfer verification and admin/affiliate confirmation/idempotent recovery; five old HTTP mutation paths return 410, GET history preserved | Complete consumers, real DB races and sandbox settlement/reconciliation; legacy pending records require audited reconciliation |
| Inventory | Dormant grouped reservation/consume/release and product/variant snapshot authority added; current workers not switched | Integrate versioned producers/consumers and late capture recovery; real DB last-unit/multi-variant/replay tests |
| Orders | Parent/shop/manual/digital inconsistencies remain | Agreed transition model; cancel/pay/fulfill races |
| Fulfillment | External create vs production push can diverge | Durable external intent IDs and timeout recovery |
| Shipping | Signature fail-open removed locally; state/replay gaps remain | Provider sandbox signature/replay and shop attribution validation |
| Analytics | Quantity arithmetic improved; synthetic views and multi-shop totals remain | D004 honest availability + scoped measured totals |
| Observability | Central HTTP/dead-job redaction; measured bounded readiness and deployment 503 gate implemented locally | Actual dependency/proxy outage drill, independent alert, remaining log audit and correlation drill |
| Recovery | Dormant outbox/receipt helpers and isolated SQL rollback tests exist; no active dispatcher/reconciler or restore drill | Proven restore/RPO/RTO, safe replay and reconciliation drill |

## Release controls

- Do not enable online payment/payout or advertise paid-pilot readiness based on passing unit tests.
- Do not deploy this work automatically. Coordinate API/worker rollout and verify browser/cookie/provider behavior in isolated staging first.
- Options A in D001–D004 were approved on 2026-10-02. Complete implementation and verification; this is not authorization to deploy, use live providers or rewrite historical records.
- Additive migrations `20261002060000_guest_message_access`, `20261003090000_economic_durable_foundation`, `20261003100000_economic_capture_allocations` and `20261004090000_economic_balance_payout` exist; none applied externally. All three economic migrations pass isolated in-memory PostgreSQL SQL/trigger tests (15 cases). This is not full-chain server migration or concurrent Prisma proof. DB-first expansion, remaining refund/debt recovery and coordinated API/worker/client rollout remain required. See economic-balance-payout-contract.md for the current M3 boundary.
- Keep historical financial records. Reconciliation exceptions require audited adjustment, not deletion.

## Highest-leverage next actions

1. Verify D001 against isolated real database, Redis, mailbox delivery and browser cookies; retain explicit historical-ownership exceptions.
2. Implement approved captured-money/refund/allocation/test-provenance design D002, with separately authorized historical reconciliation.
3. Implement D003 intents/outbox/idempotent inventory and safe consumer activation; no historical bulk replay.
4. Execute isolated real-DB/provider sandbox failure matrix and payout/refund conservation tests.
5. Finalize honest analytics/readiness contracts D004 and prove independent alerting plus restore/recovery before a new pilot decision.
