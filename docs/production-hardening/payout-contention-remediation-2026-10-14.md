# Payout contention remediation - 2026-10-14

## Scope

Fix the two code defects found while investigating the failed native
`payout-overspend-and-reject` gate on candidate `75e5644`. This work does not
deploy, alter production data, enable financial gates or establish native/pilot
acceptance. The previous CI log identified the failed scenario, not the exact
inner exception; the defects were reproduced independently.

## Changes

- Project economic account selectors to exactly `kind`, `beneficiaryId`,
  `currency` and `provenance`. Passing a full account row to reject no longer
  submits extra fields to Prisma's compound unique input. Tenant checks,
  account locks, state claims and exact allocation release are unchanged.
- Retry the whole DB-only SERIALIZABLE callback for `P2034`, or `P2010` with
  structured `TransactionWriteConflict` metadata / SQLSTATE `40001` or `40P01`.
  Preserve the three-attempt limit. Do not retry by message matching, or retry
  other raw SQL, constraint, timeout, connectivity or provider failures.
- Use the same classifier in the contention harness without changing required
  winner counts, exact state assertions or independent-session requirements.
- Retain only allowlisted driver code/type in child failure diagnostics and
  re-allowlist those fields in the parent report. No raw error, message, SQL,
  arguments, metadata, URL or stack is added to the native report.

## Regression coverage

- Strict modeled account lookups reject extra selector keys. Existing reject
  tests still require foreign-account/replay rejection and release only the
  selected payout's reservation.
- Structured raw conflicts retry with a bounded budget; other errors are
  propagated on the first attempt. The new tests failed before the fix.
- The real generated Prisma Client and real PG adapter are tested with a
  synthetic, read-only SQL transport. Network connections are explicitly
  forbidden. Four child tests cover invalid/projection selectors, the two
  conflict SQLSTATE mappings and non-conflict propagation. This is a client
  boundary test, NOT native PostgreSQL concurrency or rollback proof.
- Harness tests still reject unexpected failures and require a successful
  winner. Diagnostic tests verify that private data cannot cross the report
  boundary.

## Local verification

Uncached Nx runs passed:

- API: 98 Jest suites / 997 tests, including the four real-client boundary
  child tests; the process exited successfully without a teardown warning.
- API production build and typecheck.
- API lint: zero errors, the unchanged 175 pre-existing warnings.
- M5 foundation/migration contracts: 47 tests (including WASM migration checks,
  not native foundation acceptance).
- M5 contention contracts: 10 tests; M5 typecheck and zero-warning lint.
- `git diff --check`.

## Release limitations

Local Node is 24.14.0, below the unchanged required 24.15.0 baseline; Docker is
not available on this machine. A supported-runtime isolated native foundation,
contention and recovery rerun is still required for the new candidate before
production rollout. Prior passing CI/images or stale native evidence cannot be
reused for this changed source tree.
