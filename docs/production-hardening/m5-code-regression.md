# M5 candidate-wide code regression

Updated 2026-10-08. Executable driver implemented; complete ten-target run
**NOT RUN** here. This is code regression/build evidence only, never native
database, actual browser, mailbox/provider or release acceptance.

## Fixed execution

`pnpm nx run api:m5-regression --skipNxCache` runs these original targets in order:

1. API/admin/client lint with their original budgets (180 / 562 / 232).
2. API/admin/client production builds, including Nx build dependencies.
3. API/admin/client typechecks (after Next generates route type declarations).
4. Full unfiltered API Jest regression with coverage, serialized execution and
   private machine JSON. Zero failed, skipped, todo or empty tests/suites required.

Before execution, inventory every API test file from the filesystem. The Jest
report must contain exactly that inventory, not just passing aggregate counters;
filtered or omitted suites fail. Publish only its count/hash, not private results.

No caller-provided targets, filters, environment paths, PIDs or shell strings.
Original resolved Nx executors/options/budgets are checked first. Each target is
uncached. Source fingerprint is checked before each target and after execution;
changed candidate fails rather than certifying mixed builds. No build output
image/deployment claim: the existing Node/webpack/Next targets are exercised.

`api:m5-regression-doctor` checks runtime/checkout without target execution.
Doctor PASS never sets `regressionVerified`. `api:m5-regression-test` checks
contracts and one real local HTTP/socket-preload child; not the ten-target run.

## Environment and containment

Only an owned Linux runner with Node >=24.15 <25 is supported. Windows execution
is blocked rather than approximating process-group cleanup with taskkill. A fixed
spawn creates each Linux process group, logs are bounded and a 30-minute target
watchdog can signal only that owned group. No signaling after observed exit.
CI additionally has a 90-minute job bound. Normal child completion must close its
pipes; detached descendants outside the group are not certified by this harness.
Use a dedicated disposable CI machine/container, not a production/shared host.

Private `.env*` files in root/API/admin/client block before reading contents.
Only `.env.example`/`.env.sample` are allowed. Caller DB/provider/TLS/Node startup
and test-filter environment is not inherited. The generated test environment
keeps every economic gate off, empties provider credentials and points native
DB/Redis/Mongo/SMTP/storage to invalid synthetic localhost port 9.

A runner-owned ephemeral loopback HTTP fixture returns **503**, never successful
business data. Its exact port supplies frontend build API origins. This exercises
the existing unavailable-API build paths; it does not verify catalog/sitemap
completeness, checkout runtime, tenant behavior or a deployed application. Actual
HTTPS/browser/AppModule tests remain the separate M5.3 gate.

Node children preload a network policy: connections to that fixture, in-process
test listeners via loopback, and the original Google font download hosts on 443
only. Other TCP/Unix socket connections, including original provider/metadata/
infrastructure endpoints, are denied before connect; denials append fixed markers
without URLs/PII. Any denial fails final regression even if application code caught
it. Nx daemon/cloud and isolated plugin IPC are disabled using supported Nx
environment switches. Fonts use original TLS/download behavior, not mocks or a
global TLS bypass.

This Node preload is **not an OS sandbox**: native addons, non-Node grandchildren,
UDP and source code intentionally bypassing the policy are not proven contained.
That is why execution is restricted to dedicated fresh CI without credentials,
not promoted to a production isolation proof. Installation/dependency/font reads
are not financial provider operations. No install occurs inside the driver.

## Artifacts and release integration

Private task logs/Jest JSON stay in ignored `tmp/m5/regression-<24hex>/` and are
not uploaded. Public `artifacts/m5/<24hex>.json` includes only fixed task outcomes,
durations/exit codes/log hashes, aggregate test counters/coverage presence, source/
migration/release fingerprints and explicit false native/browser/provider flags.
The candidate fingerprint includes the root Jest preset/configuration as well as
application source; changing test configuration invalidates previous evidence.
Reports remain unsigned diagnostics; CI/source/image/reviewer provenance is still
required before release.

The M5.5 collector accepts only a complete current-candidate `m5.5-regression-v1`
`run`, never doctor, old frontend hash, incomplete/cached tasks or a newer failed
rerun. Passing it closes **code regression only**; full-stack browser/provider/
failure/whole-system recovery/owner gates remain NO-GO independently. Frontend
apps currently have no Jest unit targets; their evidence is lint/build/typecheck,
not invented unit-test coverage.

`.github/workflows/m5-regression.yml` is manual, contents-read, pinned-actions,
Node 24.15, fresh checkout, no secrets/deploy. It can generate genuine evidence
when explicitly dispatched; it has **not** been committed/pushed/dispatched here.
Its job-local dossier is partial because native reports reside in the separate
foundation job. Before acceptance, collect sanitized reports from both runs for
the exact same source into `artifacts/m5` and re-run `api:m5-release-check` in that
same clean candidate. Never merge different candidates or hand-edit flags.

Local Node 24.14 and Windows/private env prevent execution. No full API/admin/
client run, provider call or new external acceptance was performed in this
checkpoint. See [M5.5](m5-release.md) for remaining gates.

Local verification: runner contracts **12/12**, release contracts **23/23** and
related foundation/contention/sandbox/recovery contracts **39/39 + 10/10 +
18/18 + 16/16** PASS, uncached (**118 checks**, not the full API suite). M5 lint
has zero errors/warnings and M5 typecheck PASS. Doctor is BLOCKED before any
target execution; these checks do not certify native/browser/provider acceptance.
