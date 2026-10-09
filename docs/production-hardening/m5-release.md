# M5.5 — acceptance dossier and release decision

Updated: 2026-10-08. **NO-GO; M5 is not closed.** The read-only dossier/check is
implemented, not a deployment executor or payment activation request. The scope
remains step 5 of [the owner-approved plan](next-five-actions-approval-plan.md).

Latest audit corrections and their local/native/external verification boundaries
are recorded in [2026-10-09 remediation](issue-remediation-2026-10-09.md).

## Commands and artifacts

| Nx target | Meaning | Exit behavior |
|---|---|---|
| `pnpm nx run api:m5-release-test --skipNxCache` | Offline dossier/gate contracts, not integration proof | Nonzero on test failure |
| `pnpm nx run api:m5-release-report --skipNxCache` | Append sanitized JSON + Markdown in ignored `artifacts/m5/<24hex>.*` | Zero means dossier written, **not GO** |
| `pnpm nx run api:m5-release-check --skipNxCache` | Same collection with strict acceptance check | **Nonzero on NO_GO** |
| `pnpm nx run api:m5-regression --skipNxCache` | Fixed ten-target code regression on a clean owned Linux runner | Nonzero on missing prerequisites/failed targets; not full-stack evidence |

Neither report/check reads environments/credentials, starts applications/containers,
connects to databases, calls providers, migrates, changes flags, commits or deploys.
The manual isolated CI workflow collects a dossier even after failure; artifact
name/job success is not pilot acceptance. Only sanitized reports are uploaded,
not dumps/private manifests. Existing deployment workflows are not changed.

Candidate identity is a sorted SHA-256 fingerprint of public API/admin/client,
shared libraries, migrations, harness/ops source, configuration and hardening docs.
Native DB reports separately retain their existing narrower source fingerprint.
Frontend changes change the release identity without pretending native tests
exercised the frontend. Generated Next/typecheck output, private/local configs,
environments, dependencies and artifacts are excluded. Source change during
collection aborts. This is a **source** identity, not built-image attestation.

Input accepts bounded regular `<24hex>.json` files with matching run IDs; invalid
matching files fail the evidence-files gate. Other names are ignored. No raw JSON,
driver errors, arbitrary step names or PII is copied into output. For each exact
stage/action/current candidate, the latest completed execution wins: a newer
failure blocks an older PASS. Invalid/future timestamps or ambiguous ties block.
`doctor`/`up` are not execution proof. Child reports must reference the accepted
exact native parent runs and start after their parent completed. Stale source or
migration hashes cannot pass. No unapproved age threshold has been invented;
reviewers must assess timestamps and environment changes before release.

Local reports are **unsigned diagnostic evidence**, not tamper-resistant
attestations. Retain CI run/commit/artifact provenance, source/image digests and
reviewer identity for acceptance. The collector cannot authenticate hand-edited
JSON or certify the current state of a stopped DB.

## Fixed acceptance matrix

| Gate | Required proof / limitation |
|---|---|
| Runtime | Original Node 24.15+ / <25 requirement; current 24.14 fails |
| Evidence files | Bounded, parseable regular reports with safe identities |
| M5.1 native foundation | Current-source successful `verify`, fresh + upgrade chains and real connectivity; not contract-test counts |
| M5.2 native contention | Same foundation; complete 23-case native report and independent-session proof; not models |
| M5.4 local recovery | Same native parents; all eight cases, process exit/PG proof and exact restore measurements; local synthetic only |
| M5.3 HTTPS AppModule/auth/mail/browser | **Not verified:** actual AppModule/native-store/browser/mailbox driver missing |
| Provider financial reconciliation | **Not verified:** original Stripe TEST/PayPal sandbox callback/capture/refund/payout driver missing |
| Staging failure/proxy/alerts | **Not verified:** actual API/BullMQ/proxy and independent deployed alert drivers missing |
| Whole-system recovery | **Not verified:** Redis/Mongo/object/mail + app restart, approved and measured RPO/RTO missing |
| Candidate-wide code regression | Driver implemented; **not run here**. Complete current-source lint/build/typecheck/API test report required; actual browser acceptance remains in the separate M5.3 gate |
| Owner release authorization | **Not verified:** separate candidate/environment/cutoff-bound approval required |

Sandbox account/webhook binding GETs appear as **context**, not callback or
settlement proof. Synthetic HTTPS tests do not prove actual browser/mailbox or
AppModule behavior. Local public-PostgreSQL restore does not prove service RTO
or whole-system recovery; its deliberate missing acknowledgement is not zero loss.

Five external/authorization gates have no supported acceptance writer yet. The
code-regression gate now has the guarded [ten-target driver](m5-code-regression.md),
but passing it cannot close those other gates. Unknown report
versions, preflight `fullStackVerified: true`, owner booleans or pasted PASS
statements cannot close them. Actual guarded drivers and reviewed evidence
schemas/provenance must be implemented before extending this validator. It cannot
currently return GO. This is an explicit tooling boundary, **not completion of
all M5.5 acceptance**.

## Local verification — latest 2026-10-08 continuation

Code-runner contracts **12/12**, release contracts **23/23** and related harness
contracts **39/39 + 10/10 + 18/18 + 16/16** PASS, uncached (**118 checks**).
M5 lint has zero warnings/errors; M5 typecheck PASS. Full API/admin/client
ten-target execution is **NOT RUN**: doctor is BLOCKED on the Node baseline and
private `.env` presence; Windows is also unsupported for owned process groups.
Private files are preserved and their contents were not inspected. Code-regression
execution evidence is MISSING, not inferred from its twelve contract tests.
The five external/authorization gates remain NOT_VERIFIED; no deployment or
provider action occurred. See [code-regression execution](m5-code-regression.md).

### Initial dossier checkpoint — superseded verification counts

M5.5 contract tests **20/20 PASS**, including newer failure vs old PASS, exact
parent links, timestamps/case coverage, narrowed restore scope, private/error
redaction, bounded input and artifact junction escape rejection. Related harness
contracts **39/39 + 10/10 + 18/18 + 16/16 PASS**, all uncached; lint (zero
warnings/errors) and M5 typecheck PASS. These 103 checks are **not** native or
full-stack acceptance. Report generation succeeds with NO_GO; strict check
returns exit 1. Node baseline is BLOCKED, native foundation/recovery MISSING,
contention STALE, and the then-six final gates NOT_VERIFIED. No provider/deployment
operation or new numerical recovery claim.

## Finite remaining work to close M5 (original scope only)

1. Provision approved isolated Node/Docker/private synthetic manifest. Execute
   native M5.1, then M5.2 and local M5.4; retain exact-source reports and inspect
   failures without resetting history.
2. Supply separately authorized staging/sandbox and test credentials; implement
   and run the outstanding original M5.3 drivers: HTTPS AppModule/native auth,
   MFA/guest cookies, mailbox receipt, desktop/mobile seller A/B/platform RBAC,
   multi-shop pricing/discount/subsidy and original provider failure/timeout/
   duplicate/out-of-order/late-capture/mismatch/refund/payout reconciliation.
3. Implement/run the remaining original M5.4 deployed failure and whole-system
   restore drivers. Agree RPO/RTO targets first; retain measured losses, deltas,
   independent alert and app-restart timings. Public-PG snapshot-only restore
   cannot satisfy an assumed zero-loss service SLA.
4. Freeze one candidate; execute the implemented code-regression driver and
   separately the missing real browser matrix. Implement reviewed native/
   external/browser writers and validators for steps 2–3 linking exact source/
   images/environment/native parent runs; no arbitrary external JSON acceptance.
5. Review the dossier/environment-specific runbook and request separate owner
   deployment/activation approval specifying digests, residual UNKNOWNs, cohort/
   cutoff, operator, monitoring and recovery. Implementation approval/CI PASS
   does not supply this authorization.

Missing environment credentials are prerequisites, not PASS. Driver gaps remain
real implementation work, not merely requests for credentials. Personalized or
unsupported automated POD stays disabled/manual UNKNOWN without its own proof.

## Coordinated rollout/rollback — proposal, not authorization

Before external operations, owner/operator must confirm exact environment,
backup/restore evidence, source/image digests, migration checksums, DB identity,
readiness, approved flags/cutoff and recovery authority in a reviewed release
ticket. No production secrets in reports.

1. Expand first using reviewed additive migrations including guest/economic
   chains. Verify original history and native no-op repeat. No reset, financial
   backfill or rewrite.
2. Roll compatible API readers/reporting and worker consumers together with
   same-candidate admin/client. Keep versioned producers/refunds/POD/email off.
   Do not deploy a producer ahead of compatible readers/consumers. Verify actual
   reverse-proxy readiness and migrations.
3. Execute approved smoke/browser/tenant checks; verify TEST/LIVE/LEGACY_UNKNOWN
   separation, callbacks, outbox lag/dead letters, stock, money conservation,
   independent alerts and recovery against retained evidence.
4. Only if separately approved, activate the bounded new-order cohort/cutoff in
   stages. Payout/provider actions retain audited approval/reconciliation. No
   historical paid-order bulk replay. Unsupported POD/cost evidence stays UNKNOWN.
5. Invariant breaches (unexplained money, duplicate effect, tenant leakage,
   negative stock, ambiguous provider outcome, dependency failure) stop new
   admission/dispatch and freeze affected payouts. Preserve intents/captures/
   allocations/outbox/receipts/audit. Reconcile original external references;
   never delete evidence, blindly recreate provider resources, drop new tables
   or downgrade v1 records to legacy balance logic.

Review environment-specific executable rollout/recovery commands and independent
alert destination before execution. This proposal does not invent production
commands, approve live payments or authorize deploying now.
