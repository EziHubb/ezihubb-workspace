Current phase: E — M4 CLOSED locally; M5.1/M5.2 native acceptance BLOCKED; M5.3/M5.4 incomplete; M5.5 dossier tooling implemented, release NO-GO (updated 2026-10-08)

## M5 code-regression execution driver — 2026-10-08 continuation

- Owner asked to continue completing M5. Added a fixed executable ten-target
  runner: original API/admin/client lint, production build, typecheck and full
  unfiltered API Jest with coverage. No target/filter skip input; current-source
  fingerprint and original resolved lint budgets/executors are enforced.
- Fresh owned Linux/Node-baseline runner only; private env autoload is refused,
  provider credentials cleared, native endpoints invalid and economic gates off.
  Owned 503 fixture permits static build fallback without posing as native API.
  Node egress policy blocks provider/infra calls and records sanitized denials;
  it is not an OS sandbox or provider/full-stack acceptance claim.
- Guarded manual CI workflow added, not dispatched. Private logs/Jest detail are
  not uploaded. M5.5 now validates actual exact-candidate code regression reports;
  this can pass only the code gate, never browser/provider/restore/owner gates.
- Full execution remains NOT RUN/BLOCKED locally. Missing runtime/environment
  and original M5.3/M5.4 driver work are still outstanding, not reclassified PASS.
  See [m5-code-regression.md](m5-code-regression.md). No commit/push/deploy.
- Verification: runner contracts **12/12**, release contracts **23/23** and
  related harness contracts **39/39 + 10/10 + 18/18 + 16/16** PASS, uncached
  (**118 checks**, not the full API suite). M5 lint zero errors/warnings and
  M5 typecheck PASS. Full filesystem API test inventory must match executed Jest
  suites exactly; root Jest configuration participates in the candidate hash.
  Doctor BLOCKED before starting targets (Node baseline/private env; Windows
  unsupported). Private env files were preserved, not read or removed.

## M5.5 acceptance dossier — 2026-10-08

- Owner requested M5.5 continuation. Added read-only JSON/Markdown collection
  and strict `api:m5-release-check`, with fixed native/external/regression/owner
  gates. Generation success is not acceptance; strict check fails NO_GO.
- Fingerprint covers API/admin/client/shared/migrations/ops and docs, excluding
  private/local/generated files. Native proof keeps its narrower source/migration
  manifest and exact parent run links. Latest failure blocks older PASS.
- Missing/stale/invalid, contradictory steps, unknown full-stack report versions,
  doctor results and preflight booleans cannot authorize release. Raw fields are
  not copied to sanitized output; local reports remain unsigned diagnostics.
- Manual isolated CI collects a dossier, not deployment permission. Added
  coordinated rollout/rollback proposal and corrected stale readiness assessment
  to reflect M4 closeout while retaining NOT READY.
- Verification: M5.5 contracts **20/20** PASS (3.694 s); related foundation,
  contention, sandbox and recovery harness contracts **39/39 + 10/10 + 18/18 +
  16/16** PASS, uncached. These are offline/WASM/IPC/controller/model checks,
  not native/full-stack acceptance. M5 lint **0 warnings / 0 errors** and
  typecheck PASS. Collector writes a **NO_GO** dossier (exit 0 for collection);
  strict check correctly exits **1**, with Node baseline BLOCKED, native
  foundation/recovery MISSING, contention STALE and six final gates NOT_VERIFIED.
- Native evidence, real M5.3/staging/whole-system recovery drivers, final
  candidate-wide regressions and separate authorization remain outstanding.
  M5.5 acceptance and M5 are **not closed**. No deploy/activation.
  See [m5-release.md](m5-release.md) for the fixed remaining acceptance matrix.

## M5.4 local recovery implementation — 2026-10-08

- Owner explicitly requested M5.4 while M5.3 remains incomplete. Prepared eight
  fixed native local cases: capture/lifecycle kills before/after commit, real lease
  expiry/stale ACK, synthetic ambiguous external create, Redis outage/replay and
  native PostgreSQL snapshot restore into a fresh owned destination.
- Strict identity/provenance/container checks, current-source native M5.1/M5.2
  evidence, read-only fixture revalidation, exclusive parent lock through cleanup,
  nonce/PID/resource IPC barriers, bounded commands, sanitized reports and retained
  private synthetic backup. No production process/DB/provider operation or deletion.
- Readiness/independent alert witness uses a local HTTP adapter/proxy around the
  production method, not deployed AppModule/proxy/alert provider. Redis delivery
  uses scoped real LIST commands, not BullMQ worker integration. Public PostgreSQL
  backup-only RPO exposes a post-snapshot acknowledged write; service RTO stays null.
- Final uncached contract/IPC/HTTP checks **16/16** PASS (11.921 s); M5.1/M5.2
  harness regressions **39/39 + 10/10** PASS, not native acceptance. M5 lint
  **0 warnings / 0 errors**, typecheck and `git diff --check` PASS. Native recovery
  remains BLOCKED (Node **24.14.0**, no Docker/private manifest or current-source
  completed native M5.1/M5.2 reports); no numerical RPO/RTO result claimed.
  See [m5-recovery.md](m5-recovery.md) for scope and remaining acceptance. Local code
  preparation does not close M5.3/M5.4 or authorize release. No commit/push/deploy.

## M5.3 HTTPS/sandbox checkpoint — 2026-10-08

- Added real loopback HTTPS/controller/Passport/JWT/session/RBAC/CSRF/raw Stripe
  signature contracts, including separately authenticated platform gift-wrap and
  shipping approvals. Storage, refresh rotation and financial handlers remain
  synthetic; no native full-stack/browser/provider acceptance claim.
- Shared production/test CORS options with preserved policy and added guarded,
  read-only Stripe TEST/PayPal sandbox binding preflight. Separate private manifest,
  exact callback/account IDs, official endpoint allowlist and completed source-bound
  native M5.1/M5.2 reports are required before any external reads. No app activation.
- Doctor correctly reports missing runtime baseline, native evidence and sandbox
  manifest. See [m5-https-sandbox.md](m5-https-sandbox.md) for the fixed remaining
  acceptance matrix. AppModule/native auth, real mailbox, browser and actual
  provider callback/settlement drivers are still unimplemented/unverified here;
  M5.3 is NOT complete. No commit/push/deploy/provider operation.
- Final uncached verification: full API **90 suites / 889 tests** PASS
  (1168.039 s), includes the new **34 HTTPS contracts**. Separate sandbox guard
  tests **18/18**, M5.1/M5.2 harness regressions **39/39 + 10/10** PASS; not native
  acceptance. API production build, API/M5 typecheck and lint PASS; API lint
  **175 warnings / 0 errors**, unchanged budget. `git diff --check` PASS.
- At this earlier checkpoint, owner requested continuation to M5.4 after M5.3 completion. Keep the acceptance gate:
  missing full-stack/mailbox/browser/provider work and sandbox/environment
  authority are not bypassed by these passing local tests. The later explicit M5.4
  implementation request is recorded above; it does not close either milestone.

## M5.2 native contention harness — 2026-10-08

- User authorized “triển khai M5.2”. This explicitly puts isolated synthetic
  native contention back in scope after the earlier skip. It does not authorize
  provider/sandbox operations, production gates, migrations or deployment.
- Added `api:m5-contention`, 23 fixed business scenarios using the actual
  Prisma transaction functions. Fifteen contention scenarios rendezvous on two
  distinct backend PIDs before effects; first-attempt synchronization does not
  serialize transactions or override production retry rules.
- A third owned database `ezihubb_m5_scenarios` keeps all scenario effects apart
  from foundation migration/upgrade fixtures. Fresh scenarios append unique
  synthetic records; no reset, deletion, old fixture overwrite or fake balance
  credit. Test-only pending event scheduling containment preserves evidence
  without claiming publication. Failed scenarios stop the run for inspection.
- Requires matching completed native M5.1 evidence, complete source/migration
  fingerprints and read-only foundation fixture revalidation. Partial/old reports
  or absent independent-session evidence cannot set `contentionVerified: true`.
- Corrected the M5.1 PostgreSQL receipt query's argument from a scalar string
  to the driver's required parameter array, found during M5.2 review.
- Verification: M5.2 harness **10/10**, M5.1 **39/39**, targeted API regression
  **36 suites / 357 tests** PASS (156.232s), uncached; M5 typecheck/lint PASS
  with zero warnings. The first targeted run could not compile the finance
  access suite because isolated test types omitted Passport's `Request.user`
  augmentation; added the installed `passport` type to the test config and
  reran successfully without disabling diagnostics/assertions. No application
  auth logic changed. These are local modeled/SQL/HTTP tests, not native proof.
- Local harness tests, M5.1 regression and typecheck/lint evidence are recorded
  in `m5-contention.md`. Native scenarios remain **NOT RUN/BLOCKED**: Node
  24.14.0 is below the required 24.15.0, Docker is absent, and native M5.1
  acceptance is still missing. No pass/closure or paid-pilot readiness claim.
- The explicit hosted workflow now orders foundation verification before
  contention, but has not been committed, pushed, invoked or passed here.
  See `m5-contention.md` for the exact matrix, prerequisites and limits.
Status: Owner approved recommended options A in D001–D004. Implement identity/session boundaries first, then finance/allocation, durable operations and truthful contracts in dependency order. Approval is not production rollout or permission to rewrite historical money records. Paid-pilot mission is NOT complete.

## M5.1 isolated foundation — 2026-10-08

- User authorized “Triển khai M5.1”. Added a separate digest-pinned, loopback-only
  internal-network infrastructure stack and guarded Nx init/doctor/up/stop/verify
  targets. No production compose/deploy script or provider credentials are used.
- Native harness checks actual Docker context/rendered config/running container
  identity and protected DB nonce/nonprivileged role before migration. It prepares
  fresh full history and pre-M4 synthetic-fixture upgrade paths, original migration
  checksums, no-op redeploy, fixture replay and Prisma schema diff. No reset/drop.
- Synthetic fixtures cover tenant roles, product/variant/shared/unlimited/digital
  stock and uncollected multi-shop/guest identity. Password is generated privately;
  no available balance/capture/provider connection is seeded. Reports contain
  source checksums, outcomes and IDs/hash, no credentials or raw driver replies.
- Full SQL history smoke executed all **31 migrations in PGlite**. This is NOT
  native PostgreSQL/Prisma contention proof. Unit fixture validation is model-shaped,
  not a completed native seed. M5 lint/typecheck and existing API typecheck PASS.
- `api:m5-doctor` correctly reports BLOCKED: Node 24.14.0 below minimum 24.15.0,
  Docker executable/daemon absent and private manifest not initialized. Native
  verification, hosted workflow, HTTPS/provider and recovery tests NOT RUN.
- See [m5-foundation.md](m5-foundation.md) for measured final test counts, exact
  commands and evidence limits. Repository preparation does not close M5.1 native
  acceptance. No commit/push/deploy, external migration, historical mutation,
  provider operation or economic activation. M5.2 and the prior concurrency skip
  are not silently advanced/revoked by this implementation.

## Authoritative M4 closeout — 2026-10-08

- [m4-closeout.md](m4-closeout.md) reconciles the original approved scope, records
  the acceptance matrix and supersedes the historical open-M4 statements below.
- The final real gap was separately approved shipping exceptions: completed API,
  durable intent, cumulative original-money allocations, independent SQL guards,
  authenticated audit identity and two-stage admin UI. No new owner policy was
  required; the earlier “awaiting policy” statement was incorrect.
- Final uncached checks: full API **89 suites / 855 tests**, final overlapping
  focused follow-up **7 suites / 84 tests**, admin browser **36/36**, client browser
  **44/44** PASS. SQL wrappers executed **40 migration cases + 7 reader cases**,
  not counted twice. All three applications passed typecheck, lint and production
  builds; lint **0 errors**, warnings **175/549/227**, thresholds unchanged.
- No remaining repository implementation actions in the approved M4 scope.
  Unsupported artwork/provider/tax/goodwill contracts remain explicitly
  manual/UNKNOWN or blocked, not fictitiously implemented.
- M5 retains a fixed list: owner-SKIPPED multi-session PostgreSQL; unperformed
  provider sandbox/networked recovery, HTTPS/mailbox and staging failure/restore
  drills; runtime baseline and separately approved coordinated migration/release.
  Local mocked/PGlite tests do not satisfy those gates. Paid-pilot readiness is
  NOT complete. No commit, deploy, external migration, backfill or gate activation.

Completed:
- Read all six existing audit documents; checked dirty worktree and resolved Nx API targets.
- Traced identity, guest access, checkout/capture/ledger, refunds, inventory, shipping, search and affiliate flows.
- Defined dependency graph, 22 invariants, five phases and review gate before code changes.
- Implemented local access, provider-failure, diagnostic redaction, affiliate conditional transitions, filtered-search and quantity-arithmetic patches.
- Created D001–D004 decision documents, recovery/reconciliation runbook, final-re-audit and pilot-readiness reports; added dated notices to all six earlier audit documents.

Historical implementation checkpoints (superseded by the closeout above):
- Latest M4 historical shop-statistics extension (2026-10-08): repaired the multi-shop parent-total leak and unclassified Redis monetary chart. Overview/daily revenue use one shared scoped DB aggregate; all versioned contexts are excluded, archiving preserves financial history, buyer-paid shipping excludes platform support and summary/chart boundaries match. Listing detail now checks original item/shop ownership with resolved store context, not current product ownership alone. Monetary results remain LEGACY_UNKNOWN, not capture/profit/available cash; traffic is separately calendar-counter based. Latest full API **89 suites / 850 tests**, focused **3 suites / 24 tests**, API typecheck/lint/build pass; lint **175 warnings / 0 errors**, unchanged budget. The **38 migration SQL cases** and **7 new reader SQL cases** execute inside two wrappers and are not double-counted. No UI change, migration, policy change, provider write, activation or deployment. M4 remains IN PROGRESS, artwork source/approval owner choice still open.
- Latest M4 shop earnings extension (2026-10-08): found and replaced the remaining per-order legacy-only Earnings reader for versioned contexts. Shop ownership/original quote/capture allocations/settled refund journals/seller lots are read in one snapshot; prepared refunds remain pending and other shops/order-level tax remain outside the response. UI uses exact minor-unit strings, explicit LIVE/TEST/LEGACY_UNKNOWN labels, malformed/foreign evidence hiding and actor/context/role/own-shop/session-status scoped cache. Neither paid status nor an empty ledger proves capture, profit or available cash. Full API **87 suites / 827 tests**, admin browser **34/34** plus final cache follow-up **4/4**, typecheck/lint and API/admin production builds pass. No financial mutation, new migration or deploy. Artwork source/approval contract is awaiting owner choice; unsupported providers, verified production/shipment/cost, tax/override policies and external activation verification remain open.
- Latest M4 shipping/external/reporting extension (2026-10-08), superseding the earlier checkpoints below: full-shop pre-handoff customer shipping refunds now have original-quantity and API/SQL handoff guards, including prepared/unknown POD intents. Durable default-off Printify creation/original-resource recovery, independent versioned notification receipts and one-claim SMTP acceptance are integrated with platform-only audit/confirmation/reconciliation UI. TEST never sends to live providers/buyers; SMTP acceptance is not inbox delivery, POD creation is not production/shipment. Historical ledger/dashboard/marketing readers use central exclusion and clear LEGACY_UNKNOWN labels; downstream receipts are separately mode-scoped. Personalized artwork, unsupported POD providers, verified production/shipment/actual costs, tax/override policies and external verification remain open. M4 is NOT fully complete or activated. Full API regression passes **85 suites / 808 tests**, admin browser **30/30**, API/admin typechecks and lint **0 errors** with unchanged warning counts **177/549**. See `m4-implementation.md`. No commit, deploy, external migration, activation or provider operation.
- M4 checkout continuation (2026-10-08): prospective immutable create-request receipts, scoped timeout lookup, same-key/body explicit retry and cart-lock revalidation are implemented locally. Opaque session-cookie fallback, shared auth/cart/chat storage resilience, conservative consent/currency fallback and credential-free public capabilities cover checkout storage failures without enabling payments. Frozen online orders remain read-only when payments are off. Migration must precede coordinated API/client rollout; old callers missing the now-required key are rejected. Full-reload unknown requests with no committed receipt/body, lost guest cookies or changed identity fail closed for support. Shipping/tax refund integration, external versioned POD/notifications and historical reader labels remain open. This checkout slice does not complete M4 or authorize production migration/deploy/backfill.
- Current M4 extension (2026-10-08): verified original-reference refund settlement/journal/rounding and debt recovery, versioned inventory/dispatcher, payer-authorized full-reload checkout recovery, LIVE/TEST summary and legacy-reader exclusion, and audited DEAD DB lifecycle recovery are implemented locally. Shared transaction-time fulfillment gates cover seller/platform status and dispatch, progress moves and step rehoming; closed/held/unverified orders fail closed. Owner-approved gift-wrap refunds require separate platform SUPER_ADMIN approval, authenticated actor and reason frozen in the plan; cancellation never automatically refunds this fee. HTTP/SQL enforce original caps and audit identity, merchandise hashes are unchanged, and reload retains approval without auto-executing. External versioned POD/notifications, shipping/tax refund integration, full historical label alignment and checkout storage/creation-timeout edges remain open; M4 is NOT complete. Full API **76 suites / 729 tests**, **31 isolated PGlite SQL cases** (not counted twice), admin browser **24/24**, checkout/locale browser **12/12** pass. API/admin typecheck/lint pass, original warning counts **177/549**; final production builds pass (API 35.693s; admin compile 11.1s / 59 pages). Synthetic API/session fixtures only, generated next-env unchanged. See `m4-implementation.md`. No deployment, activation, external migration or backfill. PostgreSQL multi-session remains SKIPPED at owner request.
- Owner approved the recommended separate signed platform rounding journal on 2026-10-08 (latest “duyệt”). Original quantity-refund plans now include immutable planned journal rows and exact signed rounding; application and SQL recompute from original allocations, including original affiliate residual ownership. Platform reconciliation labels the adjustment as planned, not booked spend or refund proof. This preparation slice does not implement evidenced settlement/debt. Multi-session PostgreSQL checks are **SKIPPED at the owner's request**, not passed; no isolated connection is requested for this iteration. No production activation, external migration or deployment.
- M4 local checkpoint: deferred checkout provider choice; immutable original-allocation refund preparation (not dispatch/settlement); platform-only read-only reconciliation API and admin UI. See `m4-implementation.md` for exact evidence, remaining work and rounding/isolated-PostgreSQL decisions. No new deployment, external migration or economic activation. M4 and paid-pilot readiness are NOT complete. Earlier entries below retain their dated historical scope.
- M3 continuation is now registered behind rollout controls: authoritative checkout quote, durable Stripe/PayPal creation, verified capture/balance lots, beneficiary-scoped APIs and exact payout allocation/evidence settlement. Admin/affiliate payout UI uses captured balances; five legacy HTTP payout writes are retired and historical reads retained. No flag was enabled. Normal checkout provider choice and actual DB concurrency verification remain incomplete; M3 is NOT marked complete. See economic-balance-payout-contract.md for exact implemented and open boundaries. External DB/provider operations remain unperformed.
- D001 E1 implemented locally: strict Redis security counters, transactional single-use refresh rotation, Google/password MFA parity for all roles, one-use challenges, coordinated storefront form and server-verified NextAuth identity.
- E2 guest messaging implemented locally: email proof with bounded attempts/TTL, hashed HttpOnly session capability, central mailbox/owner authorization, guest inbox and composer verification, guest reply email destination and read receipts. Mocked browser and API regression checks pass; no full D001 completion claimed.
- E3a (independent D004/R20) implemented and locally tested: measured DB/Redis/Mongo/storage probes, bounded/coalesced checks, distinct liveness/readiness, deployment/container gates use readiness. No script deployed/executed. D002 money authority is not changed piecemeal. Refund/commission policy and the next five-action plan were subsequently approved on 2026-10-03; economic-activation-design.md records the coordinated activation boundary.
- Latest user approval (2026-10-03): “chốt”. next-five-actions-approval-plan.md and all proposed defaults are approved. M1 policy/conservation and M2 additive durable foundations are now in implementation; existing E1–E3a changes are preserved, not deployed. Financial activation remains off until coordinated producers/readers/consumers pass verification.

Discovered:
- Unverified password login also claims guest history, not just registration.
- Affiliate rejection and confirmation/cancellation have additional concurrent balance races.
- Error text as well as job payload can leak secrets into dead-job alerts.

Plan changes:
- M3a self-review: a balanced journal can still misclassify tax/revenue or an affiliate beneficiary. Added deferred SQL comparison against the canonical quote-derived journal, plus negative fixtures. Recheck payment method/currency after provider I/O inside the booking transaction. Mixed/gift-card tender, unsupported fee/beneficiary and unknown provider-cost paths remain explicit fail-closed integration obligations.
- Isolated SQL runner: PGlite was already installed transitively; pinned 0.4.3 as a direct devDependency (`package.json` +1 / lockfile +3 lines, offline, install scripts disabled). Jest VM cannot load its native dynamic imports, so normal Nx/Jest invokes a bounded Node subprocess. Fixed Windows loader URL and synthetic SQL parameter casts; no assertion/threshold removed. Concurrent Nx graph cache rename yielded an EPERM warning; subsequent runs use one orchestrator at a time.
- Outbox work requires stock deduplication and owner-approved economic activation first.
- Guest capability and Google challenge changes isolated as public-contract decisions.
- Added HTTP log redaction: raw query tokens/PII and exception text were exposed beyond dead-job alerts.
- Rechecked PayoutStatus.PROCESSING and preserved this supported state during guarded mark-paid/reject transitions.
- EasyPost official v1 signature includes algorithm prefix; accepted prefixed and existing bare valid digest. Timestamp/replay enforcement remains separate.
- Fixed pure quantity arithmetic in listing/product totals without changing fee policy or historical financial records; parent-order shop attribution still open.

Tests:
- M4 historical shop-statistics checkpoint PASS (2026-10-08): final stable-source full API **89 suites / 850 Jest tests**, 56.115s, uncached Nx. Focused **3 suites / 24 tests**, 22.814s; one new wrapper executes **7 actual revenue-reader SQL cases** on minimal synthetic PGlite tables, separate from the existing **38 migration SQL cases**, neither counted twice. Includes multi-shop original scope/shipping support, LIVE/TEST exclusion, archived/cancelled/refunded and unpaid receipts, UTC window consistency, injection resistance, Redis/DB failure isolation and original item/controller ownership. Earlier BigInt/key fixture errors and the overlapping full run's stale TypeScript signatures are not passing checkpoints. Final API typecheck/lint/build pass, webpack **41.606s**, **175 warnings / 0 errors**, no budget change; diff check passes and generated next-env has no change. Browser evidence below is historical, not rerun for this backend-only slice. Node engine mismatch, owner-SKIPPED multi-session PG and remaining activation/artwork boundaries persist; no deploy or external write.
- M4 shop Earnings checkpoint PASS (2026-10-08): full API **87 suites / 827 tests**, 125.712s, including the existing single wrapper with **38 isolated PGlite SQL cases**, not double-counted. Admin browser **34/34**, desktop/mobile, 2.2m, and final role/session/own-shop cache follow-up **4/4**, 50.4s. Synthetic sessions/API/provider responses only; screenshots reviewed and large-money no-overflow assertion retained. Incorrect queue fixture route and hidden-tab ambiguous selector were fixed, interrupted/failed runs not counted as pass. API/admin typecheck/lint **0 errors**, warnings unchanged **177/549**. Final builds PASS: API webpack **48.472s**; admin compile **13.1s** / TypeScript **13.0s**, **59 pages**, synthetic API URLs. No new migration; next-env restored and diff check passes. Client's prior **24/24** is retained, not rerun. No external write or activation; remaining gates in `m4-implementation.md`.
- M4 shipping/external/reporting regression PASS (2026-10-08): full API **85 suites / 808 tests**, 159.453s, including one wrapper executing **38 isolated PGlite SQL cases**, not double-counted. Admin browser **30/30**, desktop/mobile, 1.7m, with synthetic sessions/API/provider responses and real external writes blocked. API/admin typecheck/lint pass, **177/549 warnings**, **0 errors**, no relaxed budgets. Prisma validate/generate use an unreachable synthetic DSN; no external migration. Latest-source production-build results are recorded in `m4-implementation.md`. Client's previous checkout/locale **24/24** remains historical evidence, not rerun in this extension. Multi-session PostgreSQL is owner-SKIPPED; provider sandbox and M5 staging/restore remain unverified.
- M4 checkout continuation PASS (2026-10-08): full API **79 suites / 763 Jest tests**, 123.176s, including one wrapper with **34 isolated PGlite SQL cases**, not double-counted. Checkout/locale browser **24/24**, desktop/mobile, 1.7m, including blocked storage, explicit consent rejection retained after reload, lost creation response and explicit identical-key/body replay. API/client/shared API-client typechecks pass; lint zero errors, unchanged API **177** / client **227** warning counts, shared API-client clean. Final API/client builds pass through uncached Nx plus four shared builds (API 43.024s; client compile 8.7s / TypeScript 12.3s). Prisma validate/generate use an unreachable synthetic local DSN. Browser/compiler fixture failures were corrected and interrupted stale runs not counted. Synthetic evidence only; no deployment, provider operation, external migration or backfill. Multi-session PostgreSQL remains owner-SKIPPED. Details and deliberate fail-closed recovery limits in `m4-implementation.md`.
- M4 signed-rounding final compile/lint checkpoint PASS (2026-10-08): `pnpm nx run-many -t typecheck lint build -p api admin --parallel=1 --skipNxCache`, including three shared dependency builds. API webpack 45.254s; admin compile 16.7s / 59 static pages. API 177 / admin 549 warnings, 0 errors, budgets unchanged. Initial fixture non-null assertion warning removed by retaining explicit presence assertions, not relaxing lint. Synthetic `.test` API URLs only, generated next-env unchanged. Prisma validate/generate use an unreachable synthetic local DSN; no external migration. `git diff --check` PASS. Node engine warning remains; no upgrade or deployment.
- M4 signed-rounding regression PASS (2026-10-08): full API **66 suites / 622 Jest tests**, 61.021s; one wrapper executes **25 isolated PGlite SQL cases**, not counted again. Includes positive/negative bounded rounding, exact original totals, immutable draft journals, numeric-JSON rejection, balanced journal forgery, original multi-shop affiliate residuals and high-value precision. Synthetic SUCCEEDED operations only model prior history, not evidenced refund booking. Admin browser **14/14**, 1.4m, desktop/mobile, including exact signed planned rounding and malformed-response hiding. No external PostgreSQL, provider or production operation; multi-session PostgreSQL explicitly SKIPPED at owner request.
- M4 local builds PASS (2026-10-08): API, client and admin via their Nx build targets with cache disabled. Client/admin used synthetic API URLs, so this proves compilation, not production API or authentication configuration. No generated next-env changes retained. Node engine warning (24.14.0 versus minimum 24.15.0) remains; no runtime upgrade or deployment performed.
- M4 checkpoint PASS (2026-10-08): full API **66 suites / 617 Jest tests**, 129.323s (including one wrapper containing 20 PGlite SQL cases, not counted again); admin browser **12/12**, 51.0s; checkout provider-choice browser **4/4**, 1.5m; API/admin/client typecheck and lint **0 errors**, unchanged warning counts 177/549/227. Tests use isolated synthetic inputs, not provider sandbox or multi-session PostgreSQL. Initial reconciliation unit-test import and browser redirect expectation were corrected without weakening permission or financial assertions. See `m4-implementation.md` for open integration/activation gates.
- Latest production builds PASS (2026-10-06): `pnpm nx run-many -t build -p api admin client --parallel=1 --skipNxCache`, plus four shared dependency builds. The terminal session expired before its output was retrieved; read-only Nx task history independently records `success`, code 0 for API hash `7498400014392143312`, client `2979114728928210119`, admin `16799267588878219656`. Matching terminal logs confirm API webpack 40.378s; client compile 16.3s / TypeScript 24.0s / 142 pages; admin compile 20.4s / TypeScript 19.8s / 59 pages. Both API URL environment variables were synthetic `.test`: client review/sitemap sections could not fetch and remained empty, not production-data proof. Build artifacts are local verification only, not release artifacts. Node 24.14.0 remains below the declared 24.15.0 minimum; no upgrade, deployment or provider operation performed.
- Latest typecheck/lint PASS (2026-10-06): `pnpm nx run-many -t typecheck lint -p api admin client shared-utils --parallel=1 --skipNxCache`. API 177 warnings, admin 549, client 227, shared-utils clean; all have 0 errors and warning budgets were not changed. `git diff --check` also passes (line-ending notices only).
- M3 affiliate/legacy retirement checkpoint PASS (2026-10-06): full API **63 suites / 592 tests**, 85.566s, `pnpm nx run api:test --runInBand --skipNxCache`. Includes 10 HTTP cases covering five retired writes, role rejection and retained GET history, plus positive legacy-overview isolation. The 15 SQL cases inside one Jest wrapper are not added again.
- Browser recheck PASS (2026-10-06): affiliate **4/4**, 29.7s, `client:e2e --args='e2e/affiliate-finances.spec.ts'`; admin **8/8**, 30.4s, `admin:e2e`, both without Nx cache. Synthetic API/session responses only; includes timeout/reload same-key recovery, authoritative minimum, exact money, modal Escape/focus and TEST/LIVE error isolation. Initial affiliate run failed on a selector matching both cookie and payout dialogs; scoped to the named confirmation, assertions retained.
- M3 admin UI checkpoint API regression PASS (2026-10-04): **61 suites / 581 Jest tests**, 101.633s, `pnpm nx run api:test --runInBand --skipNxCache`. Includes the two new minimum/audit/exact-money response contract cases; the SQL wrapper's 15 cases are not added again to the Jest count.
- Admin/API typecheck and lint PASS via `pnpm nx run-many -t typecheck lint -p admin api --parallel=1 --skipNxCache`. Admin 562 warnings / 0 errors; API 177 warnings / 0 errors. Existing budgets unchanged. Initial admin typecheck caught a session ID type and BigInt literal target mismatch; corrected the local type narrowing and used BigInt constructors without changing precision or the compilation target.
- M3 continuation final full API regression PASS (2026-10-04): **60 suites / 579 Jest tests**, 61.583s, `pnpm nx run api:test --runInBand --skipNxCache`. Includes callback routing, HTTP authorization, provider-intent timeout/replay, quote/balance/payout tests and one wrapper containing 15 SQL cases (not added again to the Jest total). Prisma schema validation PASS with an unreachable synthetic local DSN; no external migration.
- Final M3 continuation API typecheck/lint/production build PASS, `pnpm nx run-many -t typecheck lint build -p api --parallel=1 --skipNxCache`: webpack 51.008s, shared-types/shared-constants built; lint 177 warnings / 0 errors, unchanged budget. Client/admin typechecks also passed in the preceding three-project run; no UI edits in this continuation. `git diff --check` PASS (line-ending notices only). Node 24.14.0 engine warning remains; no runtime upgrade performed. No commit/push/deploy, external migration or money movement.
- M3 continuation intermediate full regression PASS (2026-10-04): 59 suites / 572 tests, 141.057s. API/client/admin typechecks PASS; API lint PASS, 177 warnings / 0 errors, threshold unchanged. Additional callback/SQL safety cases were added afterward, so this is not the final snapshot result.
- Latest targeted callback/SQL verification PASS: 2 suites / 8 Jest tests, 20.451s; the one SQL wrapper executes 15 PGlite cases. Covers early PayPal callback retry and immutable VERIFYING reservation/binding. A previous HTTP test run passed assertions but Node/libuv crashed at shutdown on Windows; it was NOT counted as PASS. Replaced its fetch/keep-alive fixture with fully consumed, closed node:http requests; the later full process completed successfully. Node 24.14.0 remains below the declared 24.15.0 minimum.
- M3a API production build PASS (2026-10-04), `pnpm nx run api:build --skipNxCache`: webpack 34.375s, shared-types/shared-constants dependencies also built. `git diff --check` PASS (line-ending notices only). Build success does not activate unregistered economic helpers. No commit/push/deploy or external DB/provider operation performed.
- M3a full API regression (2026-10-04): 55 suites, 540 Jest tests PASS (77.147s), `pnpm nx run api:test --runInBand --skipNxCache`. One Jest test runs 11 real in-memory PostgreSQL cases; do not add them again to the Jest total. Both economic migrations execute against synthetic prerequisites, with deferred COMMIT rejection, actual rollback/dedup effect, immutable identities, multi-shop tax/funding/affiliate and lease/reservation constraints. Not networked Prisma/server contention, full historic migration-chain or provider sandbox proof.
- M3a API/client/admin typechecks PASS via `pnpm nx run-many -t typecheck -p api client admin --parallel=2 --skipNxCache`. API lint PASS (177 warnings, 0 errors, threshold unchanged); new capture/readers/schema types compile. Prisma validation and client generation PASS with an unreachable dummy local DSN. Browser E2E not rerun in M3a; no storefront/UI changes in this slice.
- Final M1/M2 API regression (2026-10-03): 50 suites, 490 tests PASS (55.222s), `pnpm nx run api:test --runInBand --skipNxCache`, including 54 new foundation tests. Final API typecheck + lint PASS (177 warnings, 0 errors); client/admin typechecks PASS. API production build PASS (webpack 58.304s, shared-types/shared-constants included). `git diff --check` PASS. No live provider/real PG contention or SQL trigger execution claimed.
- M1/M2 targeted run (2026-10-03): 4 suites, 53 tests PASS (10.062s), `economic-policy|economic-durability|inventory-policy|inventory-reservation`. Exact money conservation, modeled operation replay/lease/receipt boundaries and grouped inventory/reservation contracts. These are pure/mocked tests, not real PostgreSQL/provider concurrency proof.
- M1/M2 API typecheck + lint PASS, 177 warnings and 0 errors, budget unchanged. Prisma schema validation and generation PASS using an explicit unreachable local dummy DSN. No migration applied. Initial schema check caught overlong PostgreSQL index names; shortened explicit mapped names. Initial test title attempted JSON serialization of BigInt; switched to Jest pretty formatting, assertions unchanged.
- Latest complete API regression (2026-10-03, includes E3a): 46 suites, 436 tests PASS (123.542s), `pnpm nx run api:test --runInBand --skipNxCache`. Includes local Nest HTTP 503/success-envelope tests with mocked dependencies, probe failures, timeout/coalescing/recovery, storage read-only command and deployment-path assertions. No real infrastructure or remote scripts exercised.
- Latest API typecheck + lint PASS (177 warnings, 0 errors); no warning-budget change. Final E3a API production build PASS (webpack 35.433s), including shared-types/shared-constants. Guest verification template exists in the built assets. `git diff --check` passes; line-ending notices only.
- E1–E2 full API regression confirmed 2026-10-03: 45 suites, 425 tests PASS (86.38s), no Nx cache. The earlier full-test process became unavailable before its result could be retrieved; this is a fresh completed run, not an assumed success.
- E1–E2 Playwright latest run: 8/8 PASS (43.2s), `auth-mfa.spec.ts` + `guest-messages.spec.ts`, desktop and Pixel 5. Includes invalid proof recovery, thread navigation, guest revocation and prior MFA flows. API/provider/mail/session responses mocked; no live cookie/provider proof.
- E2 final API/client/admin typechecks PASS; client lint PASS (230 warnings, 0 errors), API lint PASS (177 warnings, 0 errors). Existing warning thresholds unchanged; new labels satisfy both explicit association and nesting. API production build PASS (42.248s), including copied guest verification email asset.
- E3a initial typecheck caught Mongo driver option mismatch; checked installed MongoDB 7.2 command implementation and corrected to `timeoutMS` + AbortSignal. Subsequent full regression/typecheck/lint passed.
- E2 latest API regression: 7 suites, 69 tests PASS (48.799s). Includes proof expiry/replay/guess budget/queue failure, cookie hash/revocation, trusted controller identity, guest/account/shop isolation, read/write/page/upload/report/hide gates and foreign order/shop association. Conditional writes modeled, not real PostgreSQL contention.
- E2 Prisma validation PASS with an explicit unreachable local dummy DATABASE_URL; client generation PASS. No migration applied and no database connection required for these commands.
- E2 browser first run found a test fixture missing the standard envelope `meta` field, so the API client correctly did not unwrap its response. Corrected the mock to match the real transform interceptor; assertions unchanged.
- E1 latest targeted API regression: 5 suites, 52 tests PASS (27.39s), `auth-hardening|auth-rotation|auth-sessions|redis-hardening|realtime-session`. Includes both Google controller contracts, role-independent challenges, replay and modeled refresh CAS/rollback. Not real PostgreSQL contention proof.
- E1 Playwright: 6/6 PASS (27.6s), `client:e2e --args='e2e/auth-mfa.spec.ts'`; desktop and Pixel 5 emulation. Four browser-flow cases plus server bridge test repeated under both projects; API/provider/session responses mocked, not a live Google or full-stack integration. Test API URL deliberately `.test`.
- E1 failures corrected: ambiguous Next route-announcer alert selector; actual input focus attempted before disabled state cleared, fixed with post-render focus. Tests retained their focus/retry assertions.
- E1 API production build PASS (webpack 55.696s); API/client/admin typechecks PASS; API/client lint PASS, no threshold changes. Client lint 231 warnings before replacing autoFocus with managed focus. Full 394-test result below belongs to earlier A–D snapshot, not this new patch.
- Last-change confirmation: `pnpm nx run api:test --runInBand --testPathPatterns='auth-hardening|stats-hardening' --skipNxCache` PASS — 2 suites, 18 tests, 5.957 seconds. These are a subset, not additional tests to add to the full-suite total.
- Full API suite: `pnpm nx run api:test --runInBand --skipNxCache` PASS — 43 suites, 394 tests, 731.458 seconds; no cache. Completed 2026-10-02.
- API production build: `pnpm nx run api:build --skipNxCache` PASS including shared-types/shared-constants builds; webpack 42.017 seconds.
- Final API typecheck + lint: `pnpm nx run-many -t typecheck lint -p api --parallel=1 --skipNxCache` PASS; lint 0 errors, 177 warnings. Threshold not changed.
- A–D API/client/admin typechecks passed; latest E1–E3a checks are recorded above.
- Initial phase A: 31 tests passed; review fixture compile failure corrected.
- Expanded run: 174 passed, one draft test failed due to inaccurate mock predicate; affiliate fixture compile failed. Fixtures corrected to model owner/session AND constraints and typed transaction callback; no production assertions weakened.
- Initial lint caught an empty shutdown catch introduced by the patch; corrected without lowering lint thresholds. Subsequent lint passed.
- Nx API configuration resolved; Node 24.14.0 below required 24.15.0 noted.
- A–D `git diff --check` passed (line-ending notices only). Browser tests were not performed in A–D; E1/E2 mocked browser evidence is recorded separately above. Real PostgreSQL concurrency, provider sandbox, restore drill and live tests remain unperformed.

Blocked:
- Recommended options A in D001–D004 are approved; repository implementation is not blocked on reapproval.
- Production activation, credentials/live provider operations and historical ownership/financial corrections remain outside authorization.
- Real PG/Redis failover, Google sandbox and financial reconciliation remain unverified. Redis-backed challenge receipts do not survive lost Redis data; durable receipts/no-eviction operational contract must be addressed before pilot.

Next:
- Implement approved D001–D004 options and execute isolated real-DB/provider/recovery verification. Detailed activation cutoffs, historical correction cases and provider access remain separately gated. No production rollout authorized.
- Owner additionally approved the reported five next actions with “duyệt 5 next actions” on 2026-10-03. Continue M3 quote/capture and coordinated allocations/balance/payout, M4 refund/inventory/fulfillment recovery, then M5 isolated runtime drills. This is not authority to deploy, apply external migrations, use production credentials or move real money.

## Approved M1/M2 implementation — 2026-10-03

- M1 policy v1, transition/commit-boundary table and concrete multi-shop/quantity/discount/shipping/refund fixtures recorded in economic-policy-v1.md; pure money helpers implemented with BigInt.
- M2 foundation added prospectively: EconomicOrderContext, EconomicOperation, EconomicOutbox, EconomicConsumerReceipt and EconomicInventoryReservation, plus additive SQL checks/immutability guards. Absence of a context preserves legacy/unknown status; no historical row backfill.
- Dormant helpers persist/claim/quarantine operations; append reference-only events; fence outbox leases with five-attempt limits; couple consumer receipts with transactional DB effects; group stock by snapshotted product/variant pool and conditionally reserve/consume/release. Unlimited stock gets reservation evidence without a decrement. Default TTL 15 minutes, explicitly configurable at helper boundary; platform-settings integration pending.
- Late capture currently fails closed pending reconciliation; automatic reacquisition/refund/fulfillment coordination is still M4. Missing/null original stock pools fail release and roll back, not silently discard evidence. Scheduling, bounded serializable retries and operator recovery UI remain open.
- No new primitives are registered in Nest controllers/modules/workers. Existing checkout/capture/finance/payout authority has NOT switched. Full quote construction, verified provider adapters, capture/store-line allocations, ledger/balance/payout/debt integration and staging drills remain M3–M5 work. NOT READY for paid pilot.

## M3a checkpoint — 2026-10-04

The earlier M1/M2 boundary is historical. Quote construction, read-only capture evidence adapters, immutable capture/part allocation/journal schema and atomic capture/Payment/outbox helpers now exist and pass local verification. Canonical journal account/beneficiary SQL guards and 11 isolated SQL cases close the previous unexecuted-economic-SQL gap only within disposable PGlite. Active producers/readers/consumers still do not use this code. NOT READY remains the pilot verdict.

Historical M3a action breakdown under the existing approval (not a new approval request; current continuation is below):
1. Complete authoritative checkout quote/operation creation, mixed tender/funding/fee boundaries and Stripe/PayPal metadata binding, without premature activation.
2. Add per-allocation captured balances and exact seller/affiliate payout reservations with evidenced settlement and explicit legacy isolation.
3. Implement original-allocation refund/reversal/debt and reconciliation, including timeout/replay and post-payout cases.
4. Connect versioned outbox consumers to inventory/late-capture recovery/fulfillment and corresponding truthful API/admin/client state together.
5. Execute isolated server/provider/tenant/browser/failure/restore drills, then present a separate release decision. Exact external environment/access remains a separate gate; no reapproval of the implementation plan is needed.

## M3 continuation — 2026-10-04

The dormant/unregistered statements above describe earlier checkpoints. Online quote/payment producers and callback routing now use the new services when a versioned context exists; new captured balance/payout APIs are registered. Legacy pre-capture checkout sale/fee credits and rewards were removed. Exact reservation/settlement persistence and actor/mode/reference safeguards were added, with a third prospective economic migration. No migration was applied externally, no configuration activated, no provider called, no transfer sent.

M3 remains in progress rather than spawning another five-action plan. Remaining M3 work: finish legacy API/affiliate UI authority switch, explicit payment-method selection, actual PostgreSQL contention verification. The owner approved continuing UI with the no-Python Quick Reference fallback; no installation occurred. M4/M5 dependencies and unverified activation risks are recorded in economic-balance-payout-contract.md. No commit/push/deploy.

## M3 admin finance UI checkpoint — 2026-10-04

- Own-store Payment account now uses verified captured balances, exact money input/display, explicit mode and truthful loading/error states. Payout requests have confirmation and same-tab persisted idempotency recovery after ambiguous timeout/reload.
- Platform UI supports explicit seller/affiliate account inspection, exact allocations, verification actor/time, rejection and same-reference verification retry. VERIFYING cannot be rejected/rebound by the UI. No transfer creation is implemented.
- Removed the old Mark paid control from platform seller payouts; retained legacy records/statements as clearly labeled reconciliation-only history. Legacy API mutation endpoints and affiliate portal remain open work, not silently claimed switched.
- Browser tests PASS: `pnpm nx run admin:e2e`, **8/8**, 27.9s, desktop Chrome and Pixel 5. Covers exact precision, confirmation/Escape, timeout/reload request-key reuse, mode switching/error isolation and VERIFYING reference binding. Two executions are the pure money test. API/browser sessions are synthetic; server route uses a synthetic signed JWT. No live API/provider/session evidence claimed. Screenshots reviewed on both viewports; no horizontal page overflow. Artifacts excluded from git.
- Earlier browser runs failed due to the session fixture and an exact-label selector including select option text; corrected the fixture/role selector, not production assertions. Stable toast server snapshot fixes the hydration warning found during this exercise.
- API overview now returns the authoritative payout minimum; history includes verification actor/time without destination configuration. New regression cases cover these contracts.

## M3 affiliate / legacy payout retirement checkpoint — 2026-10-06

- Affiliate payout UI now reads captured balances and authoritative minimum, with exact money shared helpers, explicit mode, verified-recipient-only requests, confirmation and same-tab idempotency recovery. Admin affiliate payouts uses the same captured platform panel with read-only legacy history.
- Retired the five legacy payout mutation HTTP endpoints with authenticated/role-gated 410 responses. Tests verify no old financial service call occurs; GET history is preserved. Existing service helpers and historical records remain, not converted or deleted.
- Removed the sidebar's legacy “available” claim; dashboard/admin affiliate historical balance labels identify unreconciled money. Legacy seller overview keeps historical totals but explicitly classifies them LEGACY_UNKNOWN and never advertises funds ready for deposit.
- UI skill Quick Reference fallback informed focus return, native confirmation and responsive layouts. Affiliate payout copy is English/Vietnamese; other locales fall back to English. No Python or new package installed.
- Remaining M3: explicit checkout provider choice and isolated multi-session PostgreSQL/Prisma contention evidence. M4/M5 refund/debt/report filters/consumers/provider/recovery obligations remain; NOT READY for paid pilot. No commit, push, deploy, external migration, provider operation or money movement.
