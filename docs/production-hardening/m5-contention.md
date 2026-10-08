# M5.2 — native Prisma contention and business invariants

Updated 2026-10-08. **Repository harness implemented; native acceptance BLOCKED.**
The 23 scenarios below are executable native tests, not 23 passing results.
The current machine still has Node 24.14.0 and no Docker/psql executable; required
baseline is Node >=24.15.0 <25. Native M5.1 acceptance has not been obtained.

## Authority and boundaries

The owner's explicit “triển khai M5.2” puts local isolated synthetic contention
back in scope after the previous skip. No provider credentials, real transfer,
refund/charge, SMTP delivery, POD dispatch, external DB migration, production
deployment or gate activation is authorized or performed here. Test capture,
refund and transfer replies are in-memory **synthetic TEST evidence**, never
Stripe/PayPal sandbox proof. HTTP/JWT/RBAC, browser/HTTPS and real provider
callbacks remain M5.3; process kills, Redis failures and restore remain M5.4.

## Isolation and acceptance design

- Reuses the guarded M5 loopback-only stack. Bootstrap now creates a third
  database, `ezihubb_m5_scenarios`, owned by the non-superuser application role
  with the protected environment nonce. The manifest remains compatible: the
  third URL is derived from the strictly validated local base URL, not supplied
  by a new arbitrary env value. Two foundation databases remain read-only here.
- Requires a completed `api:m5-verify` JSON with matching source/migration
  fingerprints and all native foundation steps PASS. Fingerprints now include
  API business implementation, harness, schema, SQL history, package/lock and
  workflow. Old pre-M5.2 reports must be superseded by an actual rerun, not edited.
  Foundation fixture snapshots are rechecked read-only before scenario writes.
- Before migrating the third DB, checks exact role/database/nonce, original
  checksums and completed migration records. Without a scenario ownership receipt,
  every existing public application table must be empty. A matching protected
  receipt is required to reuse a previously owned scenario DB; no existing data
  is adopted based solely on its email, status or apparent test shape.
- Calls the existing production transaction functions directly through Prisma's
  PostgreSQL adapter. Two separate pools with `max: 1` ensure separate connections.
  On the first transaction attempt, both transactions open and record distinct
  `pg_backend_pid()` values before effects. A bounded rendezvous releases both
  together; it is not a mocked lock, serialized scheduler or isolation override.
  Existing SERIALIZABLE retry rules stay in the business code. Non-retrying
  capture paths may expose a serialization conflict; replay must converge to
  the identical single capture. Unexpected failures do not count as race losers.
- Cases get separate random-run synthetic catalogs, beneficiaries and orders.
  Financial lots are created through synthetic capture booking, not direct
  balance credits. Runs append new fixtures and retain earlier evidence; no
  delete/reset/truncate, historical replay or receipt overwrite is provided.
- At successful case completion, that case's still-PENDING messages are scheduled
  far in the future in this test-only DB. They remain PENDING, not falsely
  PUBLISHED, so later scheduler tests cannot consume unrelated test cases. The
  lease case still requires a clean eligible queue. A failed case stops immediately;
  inspect retained records/report rather than automatically clearing its leases.
- Acceptance requires all 23 named cases in order, exact DB-state assertions,
  separate backend evidence for all 15 races, no full-stack/provider claim, and
  insertion of the append-only run receipt. Only then may `contentionVerified`
  become true. JSON files are local harness evidence, not signed remote attestations.

## Fixed scenario matrix

Every row is currently **NOT RUN on native PostgreSQL**.

| Scenario | Required invariant |
|---|---|
| outbox-lease-fencing-and-exhaustion | One lease winner; expired lease cannot acknowledge a replacement; exhausted attempts become DEAD |
| operation-intent-and-dispatch-replay | Same intent returns same ID; changed key contents fail; one dispatch claim; ambiguous expiry never redispatches |
| last-product-unit | Only one competing order reserves stock 1; losing reservation rolls back |
| grouped-pool-replay-and-release | Duplicate lines aggregate quantity 2+3; same context debits once; concurrent release restores once; TTL/state preserved |
| last-variant-unit | Variant stock 1 has one winner; parent quantity is not debited |
| unlimited-and-digital-pools | Concurrent orders retain null/unlimited stock and explicit reservation targets |
| multi-pool-rollback | Any failed pool rolls back all stock and reservation effects |
| duplicate-capture-and-lifecycle | One capture/lot set; journal sums zero; replay converges; one lifecycle receipt/history and no second stock debit; guest fixture |
| consumer-effect-rollback | Injected DB-effect exception rolls back both receipt and effect; competing retry applies once |
| payout-overspend-and-reject | Competing payouts cannot reserve more than eligible funds; competing rejection releases once |
| payout-settle-versus-reject | Exactly one terminal payout state; paid/reserved/available amounts conserve |
| tenant-mode-and-legacy-report-isolation | Seller A/B scopes separate; TEST does not enter LIVE/EUR reads; foreign payout scope denied; legacy query excludes versioned order |
| refund-intent-idempotency | Concurrent same-key intent has one ID; changed payload/second unresolved intent rejected |
| refund-settlement-replay | Original-reference settlement/retry creates one refund/journal/reversal; no provider redispatch |
| payout-versus-refund | Refund hold and payout reservation cannot both win |
| post-payout-refund-and-debt-recovery | Paid evidence remains; refund creates exact debt; new captured funds recover debt once under concurrency |
| multi-shop-partial-refund-rounding | Quantity 2 partials cumulatively reverse the original 101-cent fee split; quantity 3 other-shop lots untouched; affiliate allocation and journal conservation |
| gift-wrap-explicit-approval | Unapproved wrap selection fails; trusted explicit approval stored before synthetic settlement |
| shipping-pre-handoff-eligibility | Only full cancelled shop with no handoff may refund shipping; handed-off shop rejected |
| late-capture-reacquisition | Expired reservation remains unchanged; competing lifecycle retries reacquire once |
| late-capture-sold-out | Late capture cannot fulfill after another reservation; receipt/reacquisition rollback and order remains unconfirmed |
| affiliate-delivery-maturity | Pending commission becomes eligible only after all shops' delivery/lock window; no LIVE merge |
| immutable-financial-evidence | Capture/quote modifications and capture deletion are rejected; original evidence retained |

The gift-wrap kernel receives an already-trusted approver; this row is not proof
that a seller cannot forge a super-admin HTTP identity. Controller/access tests
remain separate regression evidence and full-stack authorization remains M5.3.
Lease expiry uses controlled timestamps; it is not an actual worker-process crash
or broker/network outage drill. Platform-funded shipping expense receipts and
shipping exception recovery retain M4 tests, not a new native/provider claim here.

## Run sequence

After obtaining the required Node baseline and a local Linux-container Docker
daemon, run the existing M5 initialization/start/verification commands documented
in [M5.1](m5-foundation.md), then:

```text
pnpm nx run api:m5-contention-test --skipNxCache
pnpm nx run api:m5-typecheck --skipNxCache
pnpm nx run api:m5-lint --skipNxCache
pnpm nx run api:m5-verify --skipNxCache
pnpm nx run api:m5-contention --skipNxCache
pnpm nx run api:m5-stop --skipNxCache
```

The hosted manual workflow now executes the same order after fresh local setup.
It is not dispatched in this task. Do not substitute an external Docker context,
production `.env`, LIVE mode or a manually rewritten PASS report.

If an existing M5.1 Docker volume predates the third database, PostgreSQL init SQL
does not rerun automatically. The harness will stop on the missing DB/marker.
Do **not** delete volumes or regenerate the private nonce. Retain M5.1 evidence
and use the clean isolated hosted workflow, or obtain approval for a scoped
bootstrap-only expansion of that existing local volume. No destructive upgrade
or superuser bootstrap is silently performed by `m5-contention`.

## Local verification evidence

| Check | Result and limits |
|---|---|
| `api:m5-contention-test` | 10/10 PASS, uncached; registry, evidence rejection, modeled rendezvous and generated-Prisma fixture shape/quote totals — not native execution |
| `api:m5-test` | 39/39 PASS, uncached; includes 31 historical migrations executed in disposable PGlite — not networked Prisma or contention |
| `api:m5-typecheck` | PASS; isolated config, native harness and imported business functions |
| `api:typecheck` | PASS, uncached; existing API application typecheck |
| `api:m5-lint` | PASS, zero errors/warnings; warning budget unchanged |
| Targeted API regression | 36/36 suites, 357/357 tests PASS, uncached (156.232 s); economic/inventory/reporting/checkout contracts and synthetic HTTP authorization, not native/provider proof |
| Native M5.1 / 23 native cases | BLOCKED/NOT RUN; missing Docker/runtime baseline and accepted foundation evidence |
| CI, HTTP/full-stack/provider, process kill, restore, deploy | NOT RUN |

Initial harness lint non-null warnings and generic inference errors were fixed;
no assertion or warning budget was removed to obtain passing checks.
The first targeted API run had 35 passing suites/343 tests and one suite that
could not compile: isolated ts-jest lacked Passport's ambient `Request.user`
type. Added the already-installed `passport` type to `tsconfig.spec.json` and
reran the complete targeted selection successfully, without turning off TS
diagnostics or weakening authorization assertions.

Read-only doctor report `artifacts/m5/68fbded6869e20ee04548410.json` records
`M5_NODE_BASELINE`, `M5_MANIFEST_MISSING`, `M5_DOCKER_UNAVAILABLE`; both acceptance
flags are false. The attempted native target also stopped before DB access with
`M5_NODE_BASELINE` (`artifacts/m5/402f71e49c6d40af2de507f5.json`). These are BLOCKED
diagnostics, not passing evidence. No dependency or system-runtime installation
was performed. `git diff --check` passed.
M5.2 repository preparation is complete, **M5.2 native acceptance is not closed**.
