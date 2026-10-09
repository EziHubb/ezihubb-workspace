# Audit remediation — 2026-10-09

Scope: the owner's approval to address the preceding production audit, followed
by an explicit request to deploy all pending changes on 2026-10-09. The evidence
below was collected before deployment and is not production acceptance. Release
gates, additive migrations and post-deploy verification must pass. Provider
operations, financial activation and manual server-log deletion remain outside
the deployment scope.

## Implemented changes and remaining verification

| Finding | Repository change | Verification boundary |
|---|---|---|
| EasyPost can reopen closed orders or apply delivery to another shipment | Verify and parse the same raw bytes; require an unambiguous order/shipment; lock and recheck active parent/shop status in a Serializable transaction; respect versioned capture/inventory/refund guards; persist a unique event receipt with the transition | Unit state/replay/race models pass. Actual PostgreSQL concurrent webhook/cancellation acceptance remains unverified |
| Foundation CI fails before DB identity with `ECONNREFUSED` | Check actual Docker port publication, not declared configuration. When absent, use a temporary worker-thread loopback relay to exact owned, digest-pinned containers on the original internal-only network. Retry only transient connection failures before authenticated DB identity | Real TCP relay/cleanup and negative ownership contracts pass; isolated Linux/Docker CI rerun still required. Engine publication behavior is a suspected cause, not a confirmed diagnosis of the previous runner |
| Regression production build fails with no safe diagnostics | Production tasks get `NODE_ENV=production`; only Jest gets `test`. Retain allowlisted failure markers, exit code/signal, bounded failure classification and private-log hash | Contract tests pass; actual clean Linux ten-target execution remains required. No raw logs, URLs, SQL, credentials or error messages are uploaded |
| Product Performance invents views, previous-period trend and traffic sources | Remove proportional/random values and fixed source percentages; return null/unavailable provenance. Keep only the real cumulative counter and real legacy order-item/revenue series | API tests pass. UI distinguishes unknown from zero, provides retry and an accessible daily table, and does not reuse the previous range's data. Real browser/screenshot checks remain unperformed |
| Critical-job email alerts depend on the failing Redis queue | Send a bounded, payload-free operational SMTP alert directly after final failure; preserve fixed log markers if SMTP is missing or fails | Unit tests pass. SMTP acceptance is not mailbox delivery. A stopped process or unavailable SMTP still needs a deployed independent monitor |
| Production Mongo JSON log grows without limits | Every service in production Compose gets `json-file`, `max-size: 10m`, `max-file: 3` | Parsed Compose contract passes. Configuration takes effect only when containers are recreated; existing server log has not been cleared |

### Tracking migration and notification limitation

`20261009010000_tracking_delivery_receipt` is additive and prospective. It does
not rewrite old order data. Receipt IDs use the existing `nanoid(12)` database
default. Event hashes are unique; there is intentionally no cascading foreign
key, so removing an order does not erase replay protection. Full migration-chain
execution, defaults and receipt uniqueness are tested on disposable WASM
PostgreSQL, **not native PostgreSQL acceptance**. Deploy must migrate before
restarting the API.

The delivery transition/receipt is atomic, but the existing customer notification
is queued after commit. A process crash or Redis failure in that interval can lose
the delivery email. This patch does not claim a transactional notification outbox
or exactly-once email delivery. SMTP critical-job alerts do not close that gap.

## Local evidence

- Final API production build passed; full API run passed 92 suites / 928 tests
  in 71.794 seconds. The focused tracking suite passes all 33 tests. The parallel
  full run emitted a worker-teardown warning; its source has not been established,
  so the warning is not silently classified as fixed.
- A supplementary unfiltered `--runInBand --detectOpenHandles` execution did not
  finish within a ten-minute diagnostic budget. Only its identified Nx/Jest
  executor was stopped after verifying PID, creation time, parent and diagnostic
  command ownership; Nx consequently returned exit 1. No assertion failure or
  open-handle attribution was reported before stopping. This run is incomplete,
  not a PASS, and does not erase the preceding completed full-suite result.
- M5 foundation/guard/migration contracts: 45 passed; contention contracts: 10;
  synthetic HTTPS boundary: 34; sandbox binding contracts: 18; recovery contracts:
  16; regression contracts: 16; release contracts: 23. Counts describe tests, not
  execution of native, provider, browser or recovery acceptance scenarios.
- M5 lint and typecheck passed without relaxed thresholds. Final API/admin lint
  and typecheck passed, with existing warning budgets unchanged (API 175
  warnings; admin 549 warnings; zero lint errors).
- Prisma client generation passed. No external SQL migration was applied.
- Local Node remains 24.14.0, below the original 24.15.0–24.x requirement; Docker
  and WSL are absent. Runtime/ownership/network/release guards were not weakened.

## Finite outstanding M5 acceptance

The release verdict remains **NO_GO**. This remediation does not replace or
expand the [fixed M5 release matrix](m5-release.md).

1. Run the updated current-source foundation on isolated Linux/Docker, then its
   linked native contention and local recovery scenarios. Retain sanitized exact
   candidate reports and inspect actual port-publication diagnostics.
2. Run the clean Linux ten-target regression for the same candidate. Previous CI
   results cannot certify these uncommitted changes.
3. Implement and run the original outstanding actual AppModule/auth/MFA/guest
   cookies/mailbox/desktop-mobile/tenant browser driver and original Stripe TEST /
   PayPal sandbox financial reconciliation driver on separately authorized staging.
4. Implement and run deployed API/BullMQ/proxy/independent-alert failure checks
   and whole-system Redis/Mongo/object/mail/application recovery. Agree RPO/RTO
   targets before interpreting measurements. The local PostgreSQL snapshot drill
   is not whole-system recovery or a zero-loss service guarantee.
5. Complete reviewed candidate/environment/image-bound external evidence writers
   and validators, then obtain separate release/deployment/activation approval.
   Driver/validator gaps are implementation work, not merely missing credentials.

Social OAuth publishing remains explicitly UI-only, and newsletter welcome mail
is not a durable subscriber/campaign system. These capability gaps are recorded
but not marketed as implemented or silently included in this reliability patch.

No published images, passing unit counts or owner continuation message authorize
payment activation, financial corrections, deleting server logs or deploying.
