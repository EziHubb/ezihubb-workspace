# M4 — refund, debt, reconciliation and durable consumers

Owner approved implementation on 2026-10-07. Repository implementation and local
verification CLOSED on 2026-10-08; not deployed or pilot-ready by this closeout.
See [m4-closeout.md](m4-closeout.md) for the final scope reconciliation,
acceptance matrix, verification results and fixed M5 handoff. It supersedes
earlier dated statements that M4 implementation remains open.

## Scope and checkpoints

- Close M3 provider choice; track real PostgreSQL contention as a separate
  verification gate (skipped for this iteration at owner request).
- Refund original capture allocations, preserve paid evidence, record/recover debt.
- Integrate versioned inventory/outbox/fulfillment; never replay legacy paid jobs.
- Scoped reconciliation API/UI and consistent LIVE/TEST/LEGACY reporting.
- Isolated regression, concurrency and recovery evidence; M5 staging/restore remains separate.

## Current boundary

The deployed baseline is v0.56.0 (`ad2b0d2`); deployment does not close M3's
open verification items. Earlier documents' "not deployed" statements describe
their dated local checkpoints. Online payment and economic activation stay off.

No production connection, migration, provider operation, commit or deployment is
authorized by this implementation approval. No financial history backfill.

Local Docker/PostgreSQL executables were not found at the start of this task.
On 2026-10-08 the owner chose to **skip multi-session PostgreSQL verification**
for this iteration. Record it as SKIPPED / unverified, never passed. Do not use
production as a substitute or call PGlite/model tests multi-session evidence.

## Current implementation extension — 2026-10-08

This section supersedes the preparation-only boundary below. M4 repository
implementation is CLOSED. All changes remain local, prospective and behind
disabled gates; M5 operational verification and release are separate.

### Implemented

- Final shipping-exception integration (2026-10-08): the already approved policy
  is now connected to a platform SUPER_ADMIN endpoint, durable original-capture
  intent, independent additive SQL guard, reload response and two-stage admin
  modal. One original customer-paid SHIPPING charge may be partially refunded
  with explicit exact amount, authenticated actor, reason and evidence reference,
  bounded by remaining settled collected shipping. Cumulative original-component
  floors preserve all fees/seller allocations; shipping quantities do not consume
  merchandise units. Pending/unknown operations block duplicate requests. Approval
  is not provider evidence, and preparation does not send a refund. Original
  verified settlement/debt rules still apply. See the closeout for final evidence:
  full API 89 suites / 855 tests, admin 36/36 and client 44/44 browser cases;
  typecheck, lint and production build PASS for all three applications.
- Latest historical shop-statistics extension (2026-10-08): overview counts and
  receipt revenue now share one parameterized DB aggregate and a common reader
  with the internal daily-revenue API. Redis purchase counters are never money
  evidence; Redis contributes observed traffic only. Shop revenue uses original
  shop merchandise less shop discount plus customer-paid shipping, never the
  whole multi-shop parent total, order-level extras or platform shipping support.
  Both parent and shop cancellation/refund states are checked; all versioned
  contexts are excluded, while archiving does not remove financial history.
  Summary totals and the timeline have identical rolling UTC boundaries, including
  both partial boundary days. Traffic retains its separate calendar-counter basis;
  conversion is explicitly historical order count over observed traffic, not a
  precise paid conversion claim. Listing monetary reads also check original item
  and active shop ownership; current product ownership alone cannot expose another
  shop's historical sales after reassignment. Detail routes use resolved store
  context and ignore a seller-supplied foreign target. Historical unlinked lines
  remain available where their scope permits, not silently purged. All of this
  stays LEGACY_UNKNOWN, not verified capture, bank balance, available cash or
  profit. Legacy float-shaped response fields remain compatibility projections,
  not exact minor-unit v1 monetary evidence. No schema/policy change or mutation.
- Latest shop earnings reader extension (2026-10-08): the existing order panel's
  Earnings API/UI now distinguishes original versioned capture/refund allocations
  from historical ledger data. A paid receipt or frozen quote is not capture
  evidence. One RepeatableRead snapshot rechecks shop ownership, original quote,
  complete scoped capture allocations, original settled refund journals and seller
  lots; missing/corrupt evidence errors rather than falling back to ledger zeroes.
  Original customer/fee/seller reversals are exact minor-unit strings, other shops
  and order-level tax are not included. Prepared/unknown refunds are separately
  pending, not deducted as settled. Payout reservations, paid lots and prior debt
  recovery are separately described, not called currently withdrawable cash.
  Original platform funding is distinguished from unspent estimated shipping
  support. Provider/shipping cost and profit remain null, not guessed zero.
  The read-only UI labels LIVE/TEST/LEGACY_UNKNOWN, rejects malformed or foreign
  shop responses and scopes its query cache by actor/active context/target shop.
  The legacy branch has non-overridable versioned-ledger exclusion and truthful
  historical-net/no-evidence wording. No new policy, mutation or migration.
  This response is a discriminated contract: deploy API/admin together; an older
  unclassified API response intentionally renders an error instead of false money.
- Latest shipping/external/reporting extension (2026-10-08) supersedes the
  earlier open shipping/POD/email statements. Customer-paid original shipping
  can be selected only for a fully cancelled shop before handoff, with every
  original item refunded in this request or an immutable previous settlement.
  API and SQL independently verify original quantities, cancellation, tracking,
  parent handoff history, legacy fulfillment attempts and versioned POD intents.
  Even a PREPARED/ambiguous POD intent blocks this automatic rule. Platform
  support is not seller shipping revenue. Gift-wrap still needs separate approval;
  tax-bearing and goodwill refunds remain blocked, not assumed zero. Separately
  approved shipping exceptions are integrated by the final extension above.
- Durable external intents now freeze private provider mappings/items/address or
  email recipient/content, with separate default-off POD/email gates. Claim
  commits before network I/O; retry never sends a second create. Independent
  Printify shop/order GET checks original line-specific external IDs, product,
  variant, quantity and all supplied address fields. The documented GET resource
  does not expose top-level `external_id`; that field is not treated as proof.
  Only unpersonalized, completely mapped LIVE Printify orders are supported;
  TEST cannot use live connections. Personalization/artwork, Merchize and other
  providers remain manual until verified creation/read/recovery contracts exist.
  Creation proof is not production, shipment, delivery or actual-cost evidence.
- The independent `notifications.v1` DB consumer follows original lifecycle
  receipts. Notification/tombstone and frozen email intent commit together;
  replay, user notification deletion and published/audited-DEAD event recovery
  do not duplicate in-app effects. TEST never contacts buyers. Separate bounded
  SMTP worker claims once, uses deterministic Message-ID and records verified
  SMTP acceptance, explicitly NOT inbox delivery. Timeout/crash is held for
  reconciliation, never automatically resent; SMTP has no independent resource
  lookup, so no fake recovery/resend control is provided.
- Platform-only POD/notification reconciliation UI supports environment/type/
  outcome/order filters, pagination, required preparation audit reason and a
  separate native confirmation for one-time create or original-resource lookup.
  Server-derived preparation actor, strict DTOs and original connected-shop
  binding prevent caller-supplied payload, account, endpoint or verified proof.
  Public list responses exclude private payloads, customer details and keys.
  Original intents and terminal evidence are immutable and cannot be deleted.
- Historical dashboard revenue no longer trusts lifetime cached store totals.
  A central non-overridable legacy ledger predicate preserves unlinked listing
  fees but excludes versioned shop money from overview, monthly summary,
  activities, running balances, CSV, marketing fees/revenue and old payout
  projections. Old payout history cannot advertise an available cash balance.
  Shared admin notice follows client navigation and labels monetary projections
  LEGACY_UNKNOWN; "historical ledger net" is not profit. Separate LIVE/TEST
  summaries also report original lifecycle/projection receipts, verified POD
  creations, unknown external outcomes and SMTP acceptance counts. They do not
  invent production/provider/shipping expenses from these counts.
- Refund preparation, durable dispatch and original-reference recovery are now
  platform SUPER_ADMIN workflows with strict scoped DTOs. Stripe/PayPal adapters
  verify the original account, mode, currency, capture, order and exact amount
  using fresh provider reads. Unknown results never reset an operation or allow
  blind redispatch. Webhooks reconcile only existing dispatched requests, never
  authorize a new refund. Provider mocks are not sandbox verification.
- Actual verified refunds atomically persist immutable evidence, compensating
  journal, signed rounding and original balance-lot reversals. Paid payout
  evidence is preserved; deficits become auditable debt. Eligible retained funds
  in the same beneficiary/currency/environment recover debt before new payout
  reservation. PENDING_PAYMENT, closed orders and unresolved operations are held.
- Owner's gift-wrap decision is implemented as a separate, explicit platform
  SUPER_ADMIN approval, never an automatic consequence of cancellation or packing
  status. The unchecked approval control, required reason and server-derived actor
  are frozen in the original refund plan under
  `2026-10-08.gift-wrap-explicit-approval.v1`. Only the original remaining collected
  gift-wrap allocation can be refunded; it does not reverse merchandise affiliate
  commission. Strict HTTP DTOs reject supplied actors/proof and string booleans.
  SQL independently checks matching actor/reason and original amounts/history;
  no historical plans or policy snapshots are rewritten. Reload preserves the
  original approval audit. Preparing still requires a second execution confirmation
  and independently verified provider evidence before any money is booked.
- Versioned checkout reservation and lifecycle effects use bounded Serializable
  DB-only retries. Original stock consumption, expiry/release and exact late
  reacquisition have immutable evidence; no second debit for HELD stock and no
  reset of terminal reservations. Closed/archived orders or closed shop rows
  require reconciliation instead of being reopened by capture delivery.
- Disabled-by-default dispatcher uses fenced leases and bounded batches/attempts.
  Platform-only DEAD lifecycle recovery records actor and required reason in a
  separate immutable audit. Receipt, missing DB effects and audit commit together.
  The original DEAD state and attempt counters stay unchanged. Same-event retry
  after a lost response returns the original audit, not a second execution.
- Shared fulfillment authority covers seller status/dispatch, bulk progress moves,
  custom-step rehoming, and platform status/dispatch routes. Display status or a
  legacy paid flag is insufficient: original capture, lifecycle receipt, consumed
  stock or exact reacquisition, resolved refunds/holds and current shop safety are
  checked inside the transition transaction. Versioned external tracker, email,
  push and legacy affiliate side effects are not fired through these legacy routes.
- Full checkout reload reads the payer-authorized original frozen order, including
  empty-cart and server-bound provider cases. Recovery errors block creation of a
  replacement order/payment. Closed captured orders never redirect to success.
- Prospective checkout creation now requires a client-generated opaque request
  identity. An account/cart-cookie-scoped hash, payload hash and immutable original
  response commit with the order. Retries replay the original response before
  reading an emptied cart or performing shipping-provider I/O. A serializable cart
  lock rechecks ownership, coupon, price, quantity and personalization; a new key
  cannot clone an already-checked-out unchanged online basket, including the
  verified-capture/asynchronous-cart-cleanup gap. A minimal tombstone survives
  legitimate deletion of non-financial orders; closed/deleted orders cannot be
  revived. No historical orders are rewritten.
- Client creation-timeout recovery uses a read-only lookup for that original
  request. An explicit retry resends the identical key/body held in memory, never
  auto-posts; a changed account cannot replay another account's in-memory attempt.
  Browser persistence contains only opaque references/method names,
  not contact details, money or provider secrets. Session cookies fall back from
  refused session storage. Manual orders remain usable in-memory; online creation
  and provider dispatch require a persistence mechanism. Shared auth/cart/chat,
  currency and consent storage failures no longer throw into checkout. An unknown
  or unsaved consent is not acceptance; storage failure does not enable tracking.
  An essential choice-only cookie preserves explicit rejection across reload when
  local storage is refused; it contains no identity or tracking data.
- Public checkout capability metadata contains no credentials. Frozen order
  reads remain available while online payments are disabled, without mounting
  payment controls/SDKs. API and both client creation callers share the required
  new identity contract. This additive migration must precede a coordinated
  client/API rollout: older clients without the key are deliberately rejected,
  not silently assigned a non-durable server retry identity.
- Legacy finance aggregation paths explicitly exclude versioned contexts and
  retain LEGACY_UNKNOWN provenance metadata. Separate LIVE/TEST summary reads
  immutable captures, refunds, verified payouts, debt and actual rounding using
  exact decimal strings. Unknown provider fees/actual shipping spend stay null;
  net collected is not presented as profit or a provider/bank balance. This does
  not prove every historical dashboard label has been aligned.
- Admin workflows provide explicit confirmations and LIVE/TEST-specific query
  keys. UI/UX Quick Reference guided native modal behavior, focus restoration,
  required audit input, responsive records and explicit unknown/error states.

### Latest historical shop-statistics verification — 2026-10-08

- Focused API regression: **3 suites / 24 Jest tests**, 22.814s, uncached Nx.
  One wrapper executes **7 actual reader SQL cases** on minimal synthetic tables
  in isolated PGlite, not counted again as Jest cases. This verifies query scope,
  multi-shop totals, shipping support, LIVE/TEST exclusion, archiving, parent/shop
  cancellation, unpaid/absent receipts, UTC boundaries and bound identifiers.
  Mocked tests additionally verify summary/chart consistency, DB-error propagation
  without Redis fallback, corrupt traffic, original listing ownership and resolved
  controller context. The SQL fixtures are not real migrations, networked Prisma,
  multi-session PostgreSQL or provider evidence.
- Initial unit fixtures used JSON formatting for BigInt and the shop-specific
  Redis-key shape for the platform branch; fixtures were corrected to assert each
  full expected traffic key without weakening scope. An overlapping full run
  retained pre-edit TypeScript signatures when the detail-scope tests were added;
  it is not a passing latest-source checkpoint. After source stabilized, the
  fresh full API regression passes **89 suites / 850 Jest tests**, 56.115s,
  including the previous **38 migration SQL cases** and new **7 revenue reader
  SQL cases** inside their two wrappers, neither counted twice.
- Final latest-source API typecheck, lint and production build pass through
  uncached Nx, including two shared dependency builds. Webpack **41.606s**;
  lint **175 warnings / 0 errors**, two fewer warnings from removing the old
  non-null map accesses. No lint budget change. `git diff --check` passes;
  next-env files have no retained changes. Node 24.14.0 remains below the declared
  24.15.0 minimum. No schema change in this slice; no new Prisma/migration proof.
- No UI/client source changes in this slice; earlier browser results below are
  historical, not rerun. No external write, migration, activation, backfill,
  commit or deployment. Artwork source/approval and other remaining boundaries
  below still prevent claiming M4 complete or pilot-ready.

### Previous shop earnings verification — 2026-10-08

- Full API: **87 suites / 827 Jest tests**, 125.712s, uncached Nx target,
  including the unchanged wrapper with **38 isolated PGlite SQL cases** (not
  counted again). The 19 new cases cover LIVE/TEST shop scope, ownership,
  original quote/allocation/journal/lot consistency, exact large amounts,
  settled versus pending refunds and explicit legacy routing without fallback.
- Admin browser: **34/34**, desktop/mobile, 2.2m, synthetic sessions/API/provider
  responses and blocked real external writes. New cases cover scoped earnings,
  TEST labeling, large exact money, no-capture status, pending refunds,
  malformed/foreign response hiding, offline errors and separate legacy labels.
  Reviewed captured Earnings screenshots on desktop/mobile; the high-value
  browser assertion also checks no horizontal overflow. The first fixture's
  queue route and a hidden-tab ambiguous selector were corrected without
  weakening financial or ownership assertions; interrupted/failed runs are not
  counted as pass. After additionally scoping cache to role/own shop/session
  status, the focused shop Earnings browser suite passes **4/4**, 50.4s.
- API/admin typecheck and lint pass: **177/549 warnings, 0 errors**, unchanged
  budgets. No schema/migration change in this slice. Actual Earnings source
  received conservative frontend heuristic review (no provable high/critical
  static issues) and accessible notification guidance; persistent status/error
  feedback uses native semantics. Not an accessibility certification.
- Latest-source production builds pass through uncached Nx: API webpack
  **48.472s**; admin compile **13.1s** / TypeScript **13.0s**, **59 pages**,
  including shared dependencies. Admin uses synthetic `.test` API URLs; its
  local unset-NEXTAUTH_URL warning is not production auth verification. Final
  admin lint still has **549 warnings / 0 errors** after cache-scope changes.
  Generated next-env files have no retained diff; `git diff --check` passes.
- Client's previous **24/24** checkout/locale evidence remains historical,
  not rerun for this admin/API-only slice. Multi-session PostgreSQL remains
  owner-SKIPPED; provider sandbox/networked recovery/staging are not verified.
  Node 24.14.0 remains below the declared 24.15.0 minimum. No deploy, activation,
  provider operation, historical backfill or financial mutation.

### Previous shipping/external/reporting verification — 2026-10-08

- Full API: **85 suites / 808 Jest tests**, 159.453s, uncached Nx target.
  One wrapper executes **38 isolated PGlite SQL cases**, not counted again.
  Coverage includes original shipping quantities/handoff, immutable external
  claims and evidence, scoped notification receipts, provider/address binding,
  SMTP ambiguity, strict HTTP authorization and legacy finance reader isolation.
  Fixture parameter casts and mocked query shapes were corrected without
  weakening production guards. This is not multi-session PostgreSQL evidence.
- Admin browser: **30/30**, desktop/mobile, 1.7m. Synthetic sessions/API/provider
  responses only; external network writes are blocked. Includes explicit native
  confirmations, Escape/focus return, shipping eligibility and gift-wrap approval,
  TEST/LIVE isolation, malformed response hiding, original-reference recovery,
  no blind provider retry and no email-resend control. Existing checkout/locale
  **24/24** evidence below is retained, not rerun in this extension.
- API/admin typechecks pass. Lint: API **177**, admin **549** warnings and
  **0 errors**; budgets unchanged. A new unused test import was removed,
  not hidden by changing rules.
- Latest-source API/admin production builds pass through uncached Nx plus three
  shared dependency builds: API webpack **37.252s**; admin compile **10.1s** /
  TypeScript **11.8s**, **59 pages**. Synthetic `.test` API URLs and the local
  unset-NEXTAUTH_URL warning do not verify production data/auth configuration.
  Generated next-env files have no retained diff; `git diff --check` passes.
- Prisma validate/generate pass with an unreachable synthetic local DSN;
  no external migration. The actual external-effects UI received frontend
  heuristic review and accessible status/error feedback guidance; no provable
  high/critical static issue was found, not accessibility certification.
  Node 24.14.0 remains below declared minimum 24.15.0. No production activation,
  external provider operation, email send, commit, deploy or financial backfill.

### Previous checkout verification — 2026-10-08

- Full API: **79 suites / 763 Jest tests**, 123.176s, uncached Nx test target.
  The real migration wrapper executes **34 isolated PGlite SQL cases**, not
  counted again. New coverage exercises original-response replay, guest/account
  scoping, strict HTTP request identity, changed payloads, cart-lock revalidation,
  capture/cart-cleanup clone prevention, immutable tombstones and rollback.
  Mocked Serializable retries are not multi-session database proof.
- Checkout/locale browser: **24/24**, desktop/mobile, 1.7m, synthetic sessions
  and API responses, no real provider/production writes. Includes refused browser
  storage, creation-response loss, explicit identical retry, empty-cart reload,
  disabled-payment read-only recovery, closed orders and locale state retention.
  Explicit rejection remains rejected after reload with local storage refused.
  Initial runs exposed a missing shared hook Client Component boundary and
  unguarded consent/currency/Zustand persistence. These were fixed, not hidden by
  relaxing the blocked-storage fixture. Stale dev-server runs were interrupted;
  only the subsequent complete successful run is counted.
- API/client/shared API-client typechecks pass. Final lint: API **177** and
  client **227** warnings, shared API-client clean; zero errors, budgets unchanged.
  A redundant string annotation lint error was removed, no rule disabled.
- API/client production builds pass through uncached Nx, including four shared
  dependencies: API webpack 43.024s; client compile 8.7s / TypeScript 12.3s.
  Synthetic `.test` API URLs mean unavailable sections remain empty; compilation
  is not production data/auth/provider verification. Prisma validate/generate
  use an unreachable synthetic local DSN. No migration was applied externally.
- Actual checkout source received frontend heuristic review and notification
  guidance; error/status feedback is persistent and uses native retry controls.
  No provable high/critical static issue was found, not accessibility certification.
  Node 24.14.0 remains below minimum 24.15.0. Admin's prior 24/24 browser checkpoint
  is retained; admin UI was not changed or rerun in this checkout slice.

### Previous gift-wrap verification checkpoint

- Admin browser: **24/24**, desktop/mobile, 1.1m; checkout and locale browser:
  **12/12**, desktop/mobile, 1.8m. Synthetic sessions/API/provider data; no
  production/provider operations. Includes recovery lost-response replay, required
  reason, cancellation/focus return, exact summaries, closed-order recovery and
  separate gift-wrap approval with no automatic execution after reload. Initial
  gift browser fixtures used an ambiguous partial label; exact label targeting
  fixed the test without weakening the approval or confirmation assertions.
- Full API at the current gift-wrap checkpoint: **76 suites / 729 tests**,
  124.539s. The migration wrapper passes **31 isolated PGlite SQL cases**,
  including forged gift-wrap approval, original refund caps/journal/history,
  atomic recovery rollback and terminal/audit immutability. SQL cases are not
  added again to the Jest count. SQL fixtures and a literal-type fixture were
  corrected without relaxing financial guards.
- API/admin typecheck and lint pass; warnings API **177**, admin **549**, zero
  errors, unchanged budgets. Client typecheck/lint and all three production
  builds passed before the gift-wrap addition; final API/admin production builds
  also pass (API webpack 35.693s, admin compile 11.1s, TypeScript 9.3s, 59 pages).
  Synthetic `.test` API URLs only: compilation is not production/provider proof.
  Generated next-env files have no retained diff. Prisma validation/generation
  passed with an unreachable synthetic local DSN. No external migration was applied.
- Frontend static heuristic review: no provable high/critical issue in recovery
  or refund workflow;
  focus guidance followed up with rendered browser assertions. This is not an
  accessibility certification. Node 24.14.0 is below repo minimum 24.15.0.

### Declared capability limits and M5 activation boundaries

1. Approved pre-handoff full-shop customer shipping is now wired through the
   durable planner/SQL/UI. Separately approved partial/after-handoff shipping
   exceptions are also integrated, bounded by original remaining collected money.
   Tax-bearing and arbitrary goodwill refunds remain unsupported and fail closed;
   they are not silently enabled or certified by the M4 closeout.
   Gift-wrap is supported only with the owner's separate SUPER_ADMIN approval
   rule above. Additional discretionary policy must be explicit before implementation.
2. Basic Printify creation/recovery, durable versioned notifications and separate
   operational receipt aggregates are implemented above. Personalized artwork,
   unsupported provider contracts and verified production/shipment/cost updates
   remain manual, not falsely marked completed. No automatic production-submit
   POST, cancellation POST or email resend is authorized by creation proof.
   Never send versioned jobs to the legacy POD retry worker. The reviewed monetary
   readers are scoped; this is not an exhaustive historical analytics audit.
   Shop Earnings now reads verified original allocations rather than legacy
   ledger. Any future personalized POD automation needs a separate owner choice
   of artwork source/approval (shop-approved print file versus system rendering).
   It is not an outstanding original M4 acceptance item: the approved plan permits
   unsupported contracts to remain manual/UNKNOWN. No preview URL is silently
   promoted into approved print artwork.
   Historical shop overview/daily revenue and listing detail have additionally
   been scoped to original DB rows and kept separate from Redis traffic. This
   does not establish verified historical settlement, exact partial-refund
   reporting, tax allocation or an exhaustive audit of every analytics reader.
3. Checkout identity/storage/availability integration is now implemented above.
   If neither storage nor cookies works, reload cannot recover an in-memory
   reference. If a reloaded unknown creation has not committed, no original body
   is persisted for automatic reposting; retain the reference and use lookup or
   support. Lost guest cart cookies/auth-scope changes require support rather
   than creating a replacement. These cases intentionally fail closed; do not
   claim every browser/session transition is recoverable.
4. Final local verification and M4 closure are recorded in `m4-closeout.md`.
   Multi-session PostgreSQL is **SKIPPED at owner request**, never passed. Provider
   sandbox, real networked Prisma recovery and M5 staging/restore remain unperformed.
   No deploy, activation, historical financial backfill or external migration.

## Historical preparation checkpoint — 2026-10-08

### Implemented, not activated

- Online checkout creates the frozen order without prematurely selecting Stripe.
  The payer chooses Stripe/PayPal before the existing payer-authorized endpoint
  binds the durable operation. A failed request retains its method for same-order
  retries. Stripe's pure loader prevents loading its SDK before selection.
  Manual order-request behavior remains separate; no payment is inferred.
- Original-allocation quantity-refund planner and immutable refund-intent table.
  Plans use cumulative floors, original rule/fee snapshots and original shop/line
  identities. Preparation locks the capture and beneficiary accounts, rejects
  unresolved refunds/reserved payouts and preserves idempotency. SQL guards
  reject altered fee components even if their combined total still balances.
  Owner-approved signed platform rounding policy now handles independent
  cumulative-floor differences without changing original beneficiary amounts.
  An immutable planned journal and signed rounding total are stored with each
  request. Database guards independently verify every rounding component, the
  original largest-remainder affiliate split and exact planned journal accounts
  and beneficiaries. These are plans, not spent money or completed refunds.
  This is internal preparation only: no refund HTTP action, provider dispatch,
  verified refund journal or persisted debt is enabled by this checkpoint.
- Read-only `GET /admin/economic-finances/reconciliation`, restricted to
  SUPER_ADMIN in platform context. Defaults to unresolved operations. Filters
  isolate LIVE/TEST and currency and support status, type, order/store and exact
  operation/provider reference or order number. Count and rows share a
  RepeatableRead snapshot, bounded to 48 rows. Unknown evidence/differences stay
  null; SUCCEEDED alone is not capture proof. No provider payload or credentials
  are returned. Refund rounding is an exact signed decimal string, explicitly
  marked as planned in expandable transaction details, not a booked expense.
- Admin **Verified balances & payouts → Review payment reconciliation**:
  exact amounts, explicit unknown outcomes, LIVE/TEST separation, search,
  pagination, retry-loading and expandable evidence details. No mark-paid,
  transfer or redispatch control. Existing payout views remain separate.
  The UI skill's Quick Reference fallback (previously owner approved without a
  Python install) guided labels, focus styles, loading/error feedback and
  responsive stacked financial records. No design dependencies were installed.

### Verification and limits

Latest signed-rounding checkpoint (2026-10-08):

- Full API regression: **66 suites / 622 Jest tests**, 61.021s, Nx test target
  with no cache. The migration wrapper executes **25 isolated PGlite SQL cases**
  (not added again to the Jest count), including immutable rounding plans,
  positive/negative residuals, individual fee preservation, changed-policy and
  numeric-JSON rejection, balanced journal forgery, foreign beneficiaries,
  original multi-shop affiliate tie ownership and amounts above Number precision.
  Synthetic SUCCEEDED refund rows are history fixtures, not verified refunds.
- Admin browser regression: **14/14**, 1.4m, Nx e2e target with no cache,
  desktop/mobile. Signed planned rounding displays exactly; malformed rounding
  responses are hidden behind an error state. No refund/write/provider action
  is available or requested. Synthetic API/session evidence only.
- Updated frontend static heuristic review finds no high/critical provable
  issue. Responsive guidance was checked against the existing wrapping/stacked
  records and browser overflow assertions; not accessibility certification.
- Final API/admin typecheck, lint and production builds pass through Nx with
  cache disabled. Warning counts remain API 177 / admin 549, 0 errors, unchanged
  budgets. API webpack 45.254s; admin compile 16.7s / 59 static pages. Synthetic
  `.test` API URLs only; these are local compilation artifacts, not deployment
  or production API/auth proof. Generated next-env has no retained change.
- Prisma validation/client generation pass with an unreachable synthetic local
  DSN; no migration applied. `git diff --check` passes. Node 24.14.0 remains
  below the declared 24.15.0 minimum; no runtime upgrade performed.

Earlier checkpoint before the signed-rounding approval:

- Production builds pass locally: API (webpack 43.128s), client (compile 18.3s,
  TypeScript 16.3s), admin (compile 16.2s, TypeScript 11.0s / 59 static pages).
  Client/admin used synthetic `.test` API URLs; unavailable sections and missing
  local auth-URL warnings are not production API/auth evidence. These artifacts
  are for verification, not deployment. Generated next-env files returned to
  their existing tracked paths; no generated-file change is included.
- Node 24.14.0 remains below the repo minimum 24.15.0; no runtime upgrade was
  performed. `git diff --check` passes (line-ending notices only).
- API production build passed at the initial checkpoint. Targeted reconciliation
  and HTTP access checks pass: 2 suites / 11 tests. The test fixture required an
  explicit reflect-metadata import; no application authorization was relaxed.
- API/admin/client typecheck and lint pass: 0 errors; existing warning totals
  remain API 177, admin 549, client 227. Budgets were not increased.
- Checkout browser checks pass 4/4 on desktop/mobile, including no provider SDK
  before selection, no premature Stripe request, same-method timeout retry and
  manual-order isolation. These use synthetic sessions/API responses and block
  real provider/production network, not provider sandbox evidence.
- Frontend checklist static review found no high/critical provable issue in the
  reconciliation component; this is not full accessibility certification.
- Full API regression passes: **66 suites / 617 Jest tests**, 129.323s,
  `pnpm nx run api:test --runInBand --skipNxCache`. One Jest wrapper executes
  **20 PGlite SQL cases**; these are not added again to the Jest total.
- Admin browser regression passes **12/12**, 51.0s,
  `pnpm nx run admin:e2e --skipNxCache`, including original payout cases and
  new reconciliation mode/error/search/pagination/role checks on desktop/mobile.
  Initial admin run: 10/12 passed; the two seller tests expected `/finances`, but
  existing server middleware correctly rejects the route earlier to `/dashboard`.
  Corrected the expected redirect, retaining both no-UI and no-request assertions.

### Historical remaining work at the preparation checkpoint

1. Signed platform rounding planning is implemented under the owner's 2026-10-08
   approval. Actual evidenced reversal/rounding booking remains part of the
   settlement work below. Tax-bearing, shipping/gift-wrap and arbitrary amount
   refunds remain unsupported. Listing-fee policy is unchanged.
2. Provider refund adapters and verified evidence, compensating journal, debt
   persistence/recovery and payout/refund race
   settlement guards. The current pure debt arithmetic is not persisted money.
3. Versioned outbox/inventory/fulfillment consumers, including late capture and
   reservation expiry/reacquisition. No legacy paid-job replay.
4. Whole-system finance/statistics reader alignment, refund/recovery workflows
   and reconciliation actions. The delivered report is deliberately read-only.
5. Pending-checkout full-reload recovery and frozen-order back navigation; locale
   transition state preservation alone does not prove complete reload recovery.
6. Isolated multi-session PostgreSQL/Prisma contention is **SKIPPED at owner
   request for this iteration**, not verified. Provider sandbox and recovery
   evidence remain unperformed. PGlite fixtures do not close activation gates.

The rounding choice is approved; no repeat approval is needed for its local
implementation. No isolated PostgreSQL connection is being requested for the
skipped checks. Activation/deployment and M5 restore drills remain separate.
