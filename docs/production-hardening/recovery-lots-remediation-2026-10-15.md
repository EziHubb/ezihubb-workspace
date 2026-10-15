# Recovery lot oracle remediation - 2026-10-15

The owner approved fixing the recovery gate, rerunning verification and then
continuing the pending full-code deployment. This does not authorize payment
activation, provider operations, historical backfills, resets or secret changes.

## Defect and fix

Native run `38549842586` on `50efa18` passed foundation and all 23 contention
cases, but failed its first recovery case. Its report did not identify the inner
exception. Independently reproduced a definite defect in that case: the fixture
has item/shipping/gift-wrap seller lots PLUS a positive affiliate lot, whereas
the old oracle expected only the three quote parts. It also accepted a missing
affiliate lot and counted zero seller-net parts that must not produce lots.

Replace count-only validation with exact, order-independent comparisons of each
lot's source key, amount, beneficiary kind/ID, currency, exponent and TEST
provenance. Verify all seeded paid recovery captures as well as replay captures.
Do not change production seeding, financial policy, money values, scenario names,
kill barriers, rollback checks, native proof or restore equality requirements.

Add fixed failure-stage identifiers and existing allowlisted Prisma driver
code/type to recovery reports. The parent revalidates the fields. Never retain
assertion values, error text, SQL, parameters, credentials or stack traces.

## Local evidence and pending release gates

- Red regression: three new contract tests failed against the previous oracle.
- Green: 20 recovery, 23 release and 10 contention contract tests passed; M5
  typecheck, zero-warning lint and `git diff --check` passed uncached.
- Contract fixtures invoke the actual production lot seeder using a query model;
  these results are NOT native crash/rollback or PostgreSQL acceptance.
- API business code is unchanged from the previously tested 98 suites / 997
  tests candidate. Local Node is still 24.14.0 and Docker is unavailable.
- Require fresh supported-runtime CI, all four exact-candidate Docker images,
  and native foundation/contention/recovery evidence before production rollout.
  No failing check may be bypassed and no stale evidence may be reused.

This document records authorization and local evidence, not deployment success
or M5 paid-pilot GO. Production migration/restart and post-rollout verification
must be recorded separately after they actually succeed.
