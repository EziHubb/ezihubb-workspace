# M5.1 — isolated environment, guards, fixtures and migration verification

Updated 2026-10-08. Repository implementation prepared; **native environment
acceptance BLOCKED**, not complete. No production deployment, external staging
migration, provider operation, live payment or financial backfill performed.
M4 remains closed locally; its external evidence limits are unchanged.

## Scope implemented

1. `docker/m5/compose.yml`: a new owned project `ezihubb-m5`, not the production
   compose. PostgreSQL 17, Redis 7, MongoDB 7, local S3 emulator and Mailpit images
   are pinned by registry digest. Their ports bind only to 127.0.0.1 and their
   Docker network is internal. No Docker socket mount, application build, external
   network/volume or production environment file. Redis uses AOF/noeviction.
2. `api:m5-init`: generates independent private local passwords, fixture login
   password and environment nonce into ignored `.env.m5.local` using exclusive
   creation. It never overwrites a manifest or prints the credentials. On Windows,
   keep this file within the user's private workspace: Unix mode 0600 alone is
   not a claim of Windows ACL enforcement.
3. `scripts/m5/guard.cjs`: exact host/port/database/role/bucket/mail identities,
   TEST mode, empty provider credentials and all economic gates off. Rejects
   unexpected keys, production endpoints, activation flags, interpolation and
   ambiguous secrets. Children receive a minimal environment, not ambient provider
   credentials, AWS profiles, NODE_OPTIONS or production DATABASE_URL.
4. Docker checks reject remote contexts and ambient Docker/Compose overrides.
   Before actions, rendered Compose must have the approved image digests,
   loopback ports, network and mounts. Native verification additionally checks
   actually running container project/service labels and images.
5. PostgreSQL initialization creates two foundation databases plus the separate
   `ezihubb_m5_scenarios` M5.2 database, and a non-superuser,
   non-createdb, non-createrole application role. A bootstrap-owned `m5_guard`
   schema holds a random environment marker; application role can read but not
   update/delete it. Actual DB name, role, privilege and nonce are checked before
   migration or fixtures. Localhost alone is not adequate identification.
6. `scripts/m5/prisma.config.ts` never imports root Prisma config or loads `.env`.
   Migration directories are limited to the real history or runner-created local
   `tmp/m5` subsets. No historical migration is edited, no reset/drop is offered.
7. Versioned synthetic fixtures cover buyer, seller A/B, affiliate and platform
   super admin; two MANUAL stores; last-unit, shared product pool, last variant,
   unlimited, digital and second-shop finite products; uncollected multi-shop
   quantity 2/3 and guest orders. Default-generated IDs are checked as NanoID 12.
   Login password is generated locally and hashed, not a public seed password.
   No provider connections, payment, ledger credit, commission, capture or
   economic context is invented for these uncollected orders. Free shipping is
   $100 only in this synthetic fixture's settings, not a production settings write.
8. Fixture receipts freeze source snapshot hash and migration head at creation.
   Replay verifies without updates; changed data or a nonempty unowned fixture
   database fails closed. This is not a general seed script or cleanup tool.
9. Reports in ignored `artifacts/m5/` include step outcome, source checksums,
   migration SHA-256 manifest, expected image digests and opaque fixture IDs/hash.
   They exclude passwords, DSNs, contact details and raw child/driver errors.
   A PASS action such as `init` is NOT acceptance: only successful `verify` sets
   `foundationVerified: true`.

The storage emulator is used only at its loopback endpoint with `test` credentials;
S3 support/path-style setup follows the [LocalStack S3 documentation](https://docs.localstack.cloud/aws/services/s3/).
It is not evidence about production S3 permissions, CDN or provider availability.
Digests were resolved from Docker Hub on 2026-10-08; actual container startup has
not been checked on this machine. PostgreSQL 17 is a test baseline, not a verified
match to production RDS. Confirm that version before a production compatibility claim.

## Native verification contract

`api:m5-verify` performs no reset, deletion, remote provider call or external deploy.
After exact local environment and running-container checks:

- **Fresh DB** `ezihubb_m5_fresh`: apply all 31 current migrations, seed/verify
  synthetic fixtures, check original checksums and completed migration records.
- **Upgrade DB** `ezihubb_m5_upgrade`: apply history through
  `20261004090000_economic_balance_payout`, then seed the original fixture. Apply
  remaining M4 migrations and verify that original identity, money, stock and
  status snapshots are unchanged. Replay requires the original pre-M4 migration
  head receipt; an already-current database is not substituted for upgrade proof.
- A second Prisma deploy must be a no-op, and fixture replay cannot reset rows.
  Verify NanoID, required economic tables/functions and an empty Prisma schema diff.
  The diff is read-only and never executed as a repair script. SQL triggers and
  functions are separately checked: Prisma diff alone does not model their behavior.
- Probe owned Redis/Mongo, create/HeadBucket the local test bucket and verify
  local SMTP connection/auth. No email is sent. These are infrastructure checks,
  not outage, HTTPS, delivered-email or provider tests.

The empty guest order is a deliberately uncollected identity fixture, not a valid
online payment/capture fixture. This phase does not enable online checkout.
M5.2 adds contention and economic scenarios; M5.3 adds app/HTTPS/provider testing.
The generated manifest is infrastructure-only: it does not bootstrap the API,
NextAuth or real OAuth/webhook credentials. Do not rename it to `.env` or launch
the existing production script to fill those gaps.

## Commands and prerequisites

Required: Node >=24.15.0 <25, pnpm 11.5.2, a local Linux-container Docker daemon
with Compose v2 and enough local resources for this dedicated stack. Container
memory ceilings total approximately 1.9 GiB; this is configuration, not measured
usage or a recommendation to share the production host. No Docker installation,
system runtime upgrade or remote Docker context is automated by these commands.

Run from the workspace root:

```text
pnpm nx run api:m5-test --skipNxCache
pnpm nx run api:m5-lint --skipNxCache
pnpm nx run api:m5-typecheck --skipNxCache
pnpm nx run api:m5-init --skipNxCache
pnpm nx run api:m5-doctor --skipNxCache
pnpm nx run api:m5-up --skipNxCache
pnpm nx run api:m5-verify --skipNxCache
pnpm nx run api:m5-stop --skipNxCache
```

`up` starts infrastructure, not a readiness certification. Verification bounds
temporary PG startup connection retries; identity errors are not retried. If a
service has not booted, retain the report and rerun verification after readiness,
not reset/drop or copy production credentials. Stop keeps volumes/evidence.
Do not delete the private manifest: its nonce must match the retained volumes.
M5.2 uses the third dedicated database and never changes foundation fixtures;
see [M5.2 contention contract](m5-contention.md). Do not reset either foundation
database to manufacture a passing upgrade replay.

The HTTP app addresses reserved in the manifest are 13000/13001/13002. Actual
HTTPS, cookie/OAuth routing and API/admin/client deployment remain M5.3/separately
authorized staging actions. Changing this guard to accept a remote environment
requires a new reviewed binding, not `DB_GUARD_OVERRIDE`.

`.github/workflows/m5-foundation.yml` offers explicit `workflow_dispatch` on an
isolated hosted Linux runner, with no repository production secrets/provider
calls. It installs the pinned Node baseline, runs local checks, initializes and
verifies the owned stack, then runs M5.2 contention, and retains only sanitized
JSON artifacts. Workflow has
not been dispatched or passed. Commit/push/CI invocation needs separate authority;
adding the file is not evidence of a CI run.

## Evidence this turn

| Check | Result / evidence limit |
|---|---|
| `api:m5-test` | 39/39 PASS, uncached (3.297 s); guard, fixture-model/replay and full-history SQL smoke tests |
| Full SQL history | All 31 migrations execute on disposable PGlite; pre-M4 synthetic user retained; NOT native PostgreSQL/Prisma/concurrency |
| Fixture unit tests | Generated Prisma model required-field validation, tenant/stock coverage, replay/change/unowned-data rejection; mocked transaction behavior, not full-stack proof |
| `api:m5-typecheck` | PASS for isolated Prisma config |
| `api:m5-lint` | PASS, 0 errors/warnings; budget not lowered |
| `api:typecheck` | PASS, uncached; existing API typecheck |
| `api:m5-doctor` | BLOCKED as intended: current Node 24.14.0, no Docker daemon executable, no private local manifest |
| Native full migration/upgrade/fixtures/probes | NOT RUN; runtime/Docker prerequisites missing |
| Hosted CI / external staging / provider / restore | NOT RUN |

The final doctor report is `artifacts/m5/6236a1b92b8b6fc304542628.json`
(ignored local evidence), with `foundationVerified: false`. It records
`M5_NODE_BASELINE`, `M5_MANIFEST_MISSING` and `M5_DOCKER_UNAVAILABLE`;
it does not claim a ready environment.

The first draft SQL smoke check failed because it looked for a nonexistent
`EconomicRefundSettlement` table; corrected to the actual `EconomicRefund`
contract without removing the check. Initial lint issues were corrected. Failed
draft runs are not passing evidence.

## Acceptance and handoff

M5.1 **repository preparation is implemented**, but native environment acceptance
is still BLOCKED. Close that gate only with a completed `m5-verify` report on the
exact candidate source, including fresh and pre-M4 upgrade evidence and probes.
Neither PGlite PASS nor workflow existence closes it. The owner's subsequent
explicit M5.2 request authorizes isolated synthetic contention preparation and
execution only; native execution is still blocked and not claimed.
Production deployment, provider activation, failure injection and restore remain
outside this turn.
