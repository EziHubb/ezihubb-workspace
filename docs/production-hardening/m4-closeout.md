# M4 — final scope reconciliation and closeout

Date: 2026-10-08. **M4 repository implementation and local verification: CLOSED.**
This is not production deployment, paid-pilot readiness or release approval.

## Basis of acceptance

The controlling scope is `next-five-actions-approval-plan.md`, approved on
2026-10-03, especially steps 3–4 and the milestone sequence. The subsequent M4
approval permits repository implementation, additive migrations and isolated
verification. The owner's later gift-wrap rule requires separate SUPER_ADMIN
approval. The owner's PostgreSQL multi-session skip remains a skip, not a pass.

M4 implements the prospective refund/debt/reconciliation and durable
inventory/consumer/fulfillment contracts. M5 owns staging, provider sandbox,
failure/restore drills and the separate release decision. Completing local M4
does not authorize deploy, live money, historical backfill or external migration.

## What was actually missing at this final audit

1. **Approved shipping exceptions were not integrated.** The original approved
   policy already allowed a SUPER_ADMIN to refund part of customer-paid shipping,
   including after handoff, with an amount, actor, reason, evidence and original
   collected-money cap. Earlier status notes incorrectly treated this as a new
   policy awaiting approval. Only the pure rule existed; the durable request,
   database guard, controller, recovery response and admin form were absent.
2. **The remaining-work list mixed implementation with activation.** It described
   sandbox/restore requirements as ongoing M4 development and personalized artwork
   automation as if it were mandatory despite the original plan expressly allowing
   unsupported provider contracts to remain UNKNOWN with automation disabled.
   No new artwork policy is chosen here and no preview becomes approved print art.
3. **There was no single final acceptance record.** Historical checkpoint notes
   remained useful evidence but contradicted newer implementations. This document
   and its final verification table supersede those dated open-work statements;
   historical entries are retained, not rewritten as if they had passed earlier.

## Final changes for the real implementation gap

The new platform-only shipping exception preparation endpoint is
`POST /admin/economic-finances/captures/:id/shipping-refund-override`.

- The authenticated platform SUPER_ADMIN supplies one original SHIPPING part,
  positive exact minor-unit amount, required reason and audit evidence reference.
  The server derives the actor; DTOs reject supplied actors, provider proof,
  additional item selections and gift-wrap approvals.
- `shipping-override-v1` records the separate approval, prior settled shipping
  amount, policy version and frozen balanced journal. Its quantity fields identify
  one original shipping charge; they do not consume merchandise refund units.
- Under the original capture lock, only settled immutable refunds count as prior
  money. Prepared/unknown refunds and reserved payouts block a second request.
  The same key replays the same intent; changed amount, actor, reason or audit
  reference cannot reuse it.
- For each original component, the reversal is
  `floor(original * (previousCustomer + approvedCustomer) / originalCustomer)
  - floor(original * previousCustomer / originalCustomer)`. This includes every
  original fee code/rule and seller allocation, never mutable rates. Sequential
  partial exceptions telescope exactly to the original total. Affiliate reversal
  is zero for shipping. Existing bounded platform rounding remains unchanged.
- The additive `20261008170000_economic_shipping_override` migration independently
  validates the audit identity, settled-money history, original shipping cap,
  exact component allocation and journal. Normal automatic shipping refunds still
  require full-shop pre-handoff eligibility; an exception is not that eligibility.
- After a partial exception, remaining shipping requires another separate approval;
  the normal whole-charge quantity path cannot refund it again. Merchandise and
  gift-wrap quantities remain independent. No subsidy-only charge is refundable.
- The admin modal defaults to the normal workflow. Selecting the explicit exception
  reveals the original remaining charge, exact USD input and evidence reference.
  Preparation does not dispatch. A second confirmation uses the existing original
  provider refund and independently verified settlement/debt path. Reload displays
  the stored approval without sending a new request. Errors receive keyboard focus.
- An administrator's evidence reference records their approval; it is **not**
  independently verified provider evidence. Settlement still requires fresh
  provider reads. No refund, payout, production order or email was sent in this audit.

## Acceptance matrix against the approved plan

| Approved requirement | Implemented authority / local evidence | Boundary |
|---|---|---|
| Original partial/multi-shop refunds | `economic-refund-plan`, `economic-refund-journal`, immutable intent/settlement SQL; quantity, fee, residual and shop-isolation tests | No mutable rate recalculation or other-shop reversal |
| Refund timeout/replay | Durable operation claim and original-reference Stripe/PayPal verification; webhook/settlement tests and two-stage browser flow | No automatic redispatch; sandbox remains M5 |
| Refund after payout / debt | Original lot reversal, immutable paid evidence and scoped debt recovery; SQL paid-payout/debt cases | No outside-account automatic debit |
| Customer shipping / gift wrap | Full-shop eligibility plus separately approved shipping exceptions; explicit gift-wrap approval; HTTP/unit/SQL/browser cases | Subsidy is not seller credit; cancellation is not refund proof |
| Reconciliation / truthful finance | Platform-only filters, scopes, exact expected/verified/difference values, original shop Earnings, shared reporting exclusions and legacy daily-revenue reader | TEST/LIVE/LEGACY_UNKNOWN remain distinct; unknown expense/profit is not zero |
| Atomic DB outbox / receipts | Operation/capture/refund transaction boundaries; fenced bounded dispatcher and transactional lifecycle/notification receipts | Redis is not committed-event or money authority |
| Original stock pools / late capture | Snapshotted grouped product/variant pools, consume/release, expiry and conditional reacquisition with immutable evidence | Shortage/closed order blocks fulfillment; refund is not restock evidence |
| Dead-event recovery | Audited platform-only DB lifecycle recovery using original event identity and receipts | No resetting DEAD/terminal records or replaying historical paid jobs |
| Physical/digital/parent lifecycle | Shared fulfillment gates, versioned routing exclusions and parent/shop progression tests | Manual/uncollected requests never imply payment or automatic production |
| External fulfillment / notifications | Immutable private intents, one-way claims, scoped Printify resource verification, DB notifications and SMTP acceptance | Supported capability limits below; no claim that creation is shipment or SMTP is delivery |
| Client integration / recovery | Required scoped checkout identity, immutable response receipt, explicit provider choice and storage-failure recovery | Lost identity/uncommitted reload fails closed for support, not a replacement order |
| Safe rollout / historical data | Default-off gates, additive migrations, original evidence preservation and legacy exclusions | No migration/backfill/deploy/activation performed |

## Declared capability limits — not falsely completed features

- Automated POD is limited to fully mapped, unpersonalized LIVE Printify orders.
  Personalized artwork and unsupported providers remain manual/UNKNOWN. No
  system-rendered art pipeline or shop-approved-art policy is introduced without
  owner choice. This follows the original unsupported-provider fallback, rather
  than inventing a new M4 acceptance condition.
- Production submission, provider cancellation, verified shipment/delivery and
  actual production/shipping-cost booking are not inferred from order creation.
  These require their own verified provider contracts before automation.
- SMTP acceptance is recorded, not inbox delivery. SMTP has no independent
  resource lookup in this integration; ambiguous sends remain held, with no blind
  resend. This limit cannot be removed by a UI confirmation.
- Tax-bearing refunds, arbitrary goodwill and mixed/gift-card tender remain
  unsupported and blocked. Unknown actual provider/tax/shipping costs remain
  unreconciled/null, not zero or a made-up seller charge. The approved policy
  explicitly requires verified allocation/evidence before using such amounts.
- LEGACY_UNKNOWN reports are historical compatibility projections, not verified
  capture, bank balance, exact partial-refund profit or available payout cash.
  This audit does not certify every historical analytics reader or repair old data.

## Final verification

All tasks below completed with exit code 0, without Nx cache reuse.

| Check | Completed result |
|---|---|
| Full API regression | 89 suites / 855 Jest tests PASS, 191.163 seconds |
| Final refund/SQL/authorization follow-up | 7 suites / 84 tests PASS, 53.45 seconds; overlaps the full suite, not additional coverage to add to its count |
| SQL execution inside Jest wrappers | 40 economic migration cases and 7 historical revenue-reader cases PASS; included in the above wrapper tests, not counted twice |
| Admin browser suite | 36/36 PASS, 2.4 minutes, desktop Chrome and Pixel 5 emulation |
| Client browser suite | 44/44 PASS, 2.6 minutes, desktop and mobile Chrome |
| API/admin/client typecheck | All three PASS |
| API/admin/client lint | All three PASS, 0 errors; respectively 175 / 549 / 227 existing warnings, no threshold changes |
| API/admin/client production builds | All three PASS with shared dependencies; API webpack 37.878 seconds, admin compile 14.8 seconds / TypeScript 12.0 seconds |

SQL ran in isolated disposable PGlite, not networked PostgreSQL/Prisma contention.
Browser sessions, API/provider responses and build API URLs were synthetic;
`.test` URLs never prove production data, provider connectivity or successful
payment. Browser checks include required approval, exact remaining-money caps,
two-stage confirmation, reload without redispatch, error focus and mobile layout.
The UI/UX skill's focus guidance informed those checks; static frontend review
found no provable issue but is not an accessibility certification.

Final production source passed the complete API run. Afterwards, test-only
non-null assertions were replaced with explicit guards and covered by the final
focused run; the admin build validated its equivalent typed-list cleanup.
Generated client `next-env.d.ts` imports were restored to their original workspace
paths. Final `git diff --check` passed. Existing unrelated worktree changes were
preserved. No commit, push, deploy, external migration, historical financial
backfill or activation was performed.

There are **no outstanding repository implementation actions in the approved M4
scope**. The capability limits above remain explicit unsupported/disabled paths;
they are not certified features. The fixed operational gates below belong to M5
and must pass separately before a production/pilot completion claim.

## M5 / activation handoff (fixed list, not another M4 next-action loop)

1. Isolated networked PostgreSQL/Prisma contention and worker-crash recovery.
   Multi-session checks were skipped by the owner in this iteration: **SKIPPED**.
2. Stripe/PayPal sandbox capture/refund/payout evidence, duplicate/out-of-order
   callbacks and timeout/late-capture cases: **UNPERFORMED**.
3. Verified provider capability/connection and HTTPS/mailbox tests; exercise only
   supported POD/email flows and keep unsupported ones disabled: **UNPERFORMED**.
4. Staging API/worker/Redis failure and backup/restore with measured RPO/RTO and
   monetary reconciliation: **UNPERFORMED**.
5. Correct runtime baseline (local Node 24.14.0 is below required 24.15.0), reviewed
   ordered migration rollout and coordinated API/admin/client release; separate
   owner approval for external migration/deploy and live cutoff: **NOT AUTHORIZED**.

Keep dispatcher/payment/refund/payout/POD/email activation gates off until those
release gates are independently satisfied. Never roll back by deleting financial
evidence or routing versioned orders into legacy retry workers.
