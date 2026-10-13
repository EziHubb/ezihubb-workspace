# P2 remediation — 2026-10-12

Scope: dependency advisories, the scanned schema drift, gift-card logging,
search accessibility/heading semantics and investigation of the previous Jest
worker-teardown warning. Existing P1 edits are preserved. No commit, deployment,
production database access, historical data rewrite or provider activation.

Status: code remediations verified locally. The dependency lane remains open for
the two unpatched development advisories below; Linux CI/release acceptance is
not claimed. Skills used: `nx-workspace`, `nx-run-tasks`, `ui-ux-pro-max`.

## Dependencies

Nx packages are aligned at 22.7.10. Update the affected direct dependencies
(CSV parser, Mongoose, Multer, Babel) and constrain vulnerable transitive release
lines in `pnpm-workspace.yaml`. Keep UUID on the CommonJS-compatible 11.1.1
release for older consumers. CSV parser 7 is covered by the existing store-scoped
CSV import tests and a quoted-cell compatibility smoke. Firebase/Google Storage's
CommonJS UUID consumer was also checked. No audit exclusions were added.

The initial all-dependency audit reported 87 findings (35 high, 44 moderate,
8 low). The updated lockfile reports **2 findings**, both development-only:

| Package | Severity | Published version still affected | Follow-up |
| --- | --- | --- | --- |
| braces | High | 3.0.3 | Await a published fixed release/upstream dependency replacement. |
| sprintf-js | Moderate | 1.0.3, 1.1.3 | Await a published fixed release/upstream dependency replacement. |

The registry does not publish the audit feed's suggested 3.0.4 / 1.1.4 versions
as of this check. GitHub advisories likewise list no patched release:
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).
These are retained risks, not fixed or suppressed findings. Do not feed untrusted
patterns/format strings into build/test tooling. `pnpm audit --prod --json`
reports **0 findings**; that is a dependency inventory result, not proof that
production has no vulnerabilities.

Existing peer mismatches remain: the intentional canvas stub for jsdom,
jest-mock-extended's Jest 29 peer range against Jest 30, and next-auth's
Nodemailer 7 peer range against Nodemailer 10. No unrelated major upgrade or
peer-range suppression is used to hide these.

## Schema contract

Keep the SQL constraints already shipped:

- Explicit `onUpdate: NoAction` for `EconomicExternalEffect.context` and
  `EconomicNotificationReceipt.event`; do not replace immutable evidence
  references with cascading updates just to silence drift.
- Map the refund-journal index to its existing migration name,
  `EconomicRefundJournalEntry_account_beneficiary_currency_idx`.

No new P2 migration is required: these changes align Prisma with existing SQL,
without rebuilding indexes or changing rows. The P1 outbox migration is still
required for the accompanying P1 changes at a future deployment.

The disposable WASM migration-chain test now compares every public foreign key
and index against Prisma-generated SQL plus exact definitions of the three
migration-owned partial/expression indexes (conversation uniqueness and shipping
subsidy reporting). Negative controls drop a FK, rename an index, and drop guest
conversation uniqueness, confirming each deviation is detected. The generator
uses the guarded synthetic config and never reads the private workspace `.env`.
This is catalog/ordering coverage, **not native PostgreSQL acceptance**, and does
not assert equivalence of every trigger/function/check/column default.

## Private logging

Gift-card purchase logs retain only the card record ID, not the redeemable code
or recipient. The email worker also logs job/template references instead of
recipient/subject and does not log raw SMTP error messages. Recipient and code
remain in the authorized response and email-delivery payload where required.
Regression tests check delivery is preserved and sensitive values stay out of
success/failure logs. Historical logs and existing Redis job payloads are not
deleted by this change.

## Search semantics, without restyling

Use the UI/UX skill's semantic-label and heading guidance only. The search page
gets one localized, screen-reader-visible H1; shared collection grids do not get
a duplicate H1. Shared minimum/maximum price inputs receive accessible names;
the sort select's name uses English/Vietnamese/Chinese translations. A client
translation hook keeps the heading compatible with in-place locale switching.

The compiled Tailwind CSS is byte-identical before/after dependency updates and
semantic fixes:

- client: `be6e5be26ec0d7be4003076b51aa29b1f3ca714e6c7b0293ed2c408cc5ac965e`
- admin: `b6da76e814b44c6f70d3157bb9e6f594d1ffa9df8240cc509cd9018e26b4072e`

Playwright checks names/headings in all three locales on desktop/mobile, alongside
the existing axe/keyboard/consent smoke. Browser API calls use a synthetic origin.

## Verification and boundaries

- Initial semantic browser suite: 12 passed (desktop/mobile).
- Migration/harness suite: 46 passed; M5 harness lint/typecheck passed.
- API/client/admin typecheck and lint passed with existing warning debt. Final
  API/client rerun also passed: 175 API warnings, 228 client warnings, no errors;
  the admin check reported 562 warnings, no errors. No warning cap was raised.
- Focused health `--runInBand --detectOpenHandles`: 11 passed; exited cleanly.
- Unfiltered `--detectOpenHandles` was stopped after roughly seven minutes of
  diagnostic execution without an assertion result or handle attribution. Only
  its verified owned Nx/Jest executor was stopped. This is **incomplete**, not a
  PASS. No `forceExit`, arbitrary teardown delay or disabled assertion was added.
- Pre-cleanup parallel API run: 96 suites / 985 tests passed in 817.688 seconds,
  but reproduced the worker-teardown warning. It is not a clean teardown PASS.
  The health HTTP fixture was the only remaining use of global `fetch` in API
  tests and left its liveness response unconsumed. It now consumes every response
  via bounded `node:http` requests with `agent: false` and `Connection: close`,
  matching the other loopback HTTP fixtures. This is a concrete transport cleanup,
  not a claim that the warning's sole cause has already been proven.
- A separate focused run exposed a TypeScript cast error in the new email-log
  fixture; it was corrected. That run and a concurrent build rerun were stopped
  after verifying their owned process trees to relieve pressure on the 8 GB
  machine. Neither interrupted rerun is counted as successful verification.
- Post-cleanup parallel API run: **97 suites / 986 tests passed** in 51.303
  seconds, exited cleanly without the worker-teardown warning. No `forceExit` was
  configured. This includes both private-logging regression suites.
- Final API production build passed (36.706 seconds). Nx Cloud's flaky-task
  marker includes the explicitly interrupted, memory-pressure build above; it
  is not an unexplained successful/failing production assertion pair.
- Post-cleanup focused handle probe: **7 suites / 75 tests passed**, covering
  loopback HTTP/TLS fixtures and both private-logging suites; exited cleanly
  without an open-handle report.
- Final browser rerun: **12 passed** in 55.2 seconds (desktop/mobile, three
  locales, axe/keyboard/consent smoke).

The machine is still on Node 24.14.0, below the repository's 24.15.0 minimum;
requirements were not relaxed. Windows local client/admin production builds and
native PostgreSQL/provider acceptance were not performed. Linux CI/release
verification remains necessary. This work does not close M5's NO_GO criteria.
