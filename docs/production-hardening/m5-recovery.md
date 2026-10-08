# M5.4 — isolated failure and PostgreSQL recovery harness

Status (2026-10-08): implementation checkpoint, **NOT milestone acceptance**.
The owner explicitly requested M5.4 implementation while M5.3 is incomplete.
This authorizes preparing/running guarded local synthetic checks; it does not
complete M5.3, authorize a production outage, enable providers or approve release.

## Executable scope

`api:m5-recovery` implements the following fixed eight-case contract. None is
silently skipped; a failed case stops the run and prevents `recoveryVerified`.

| Case | Failure boundary and required recovery |
| --- | --- |
| Capture before commit | Kill the owned process after actual capture/journal/payment/outbox effects inside the transaction, before COMMIT; require rollback, original-operation replay, exactly one capture/outbox and zero-sum journal |
| Capture after commit | Kill after booking returns, before the caller receives its acknowledgement; original evidence reread must return the same capture without new money/lot/outbox effects |
| Lifecycle before commit | Kill inside the real receipt/inventory/order transaction; require no receipt/status progress, held stock unchanged, then one successful replay |
| Lifecycle after commit | Kill after successful consumption; replay must return false, stock remains debited once and confirmation history remains singular |
| Claimed outbox worker | Kill after a real lease claim; wait for real 30-second expiry (no forged clock), recover on attempt two, reject old-token ACK, apply lifecycle once |
| Ambiguous external create | Synthetic external resource commits separately, then kill before local ACK; unknown outcome cannot create again; original-resource lookup settles the same frozen intent |
| Redis outage | Stop only the owned Redis container; production security counters fail with 503, ordinary cache returns null, PostgreSQL capture/outbox survive publish failure; reconnect, persist the counter, deliver duplicate list entries and consume once |
| PostgreSQL restore | Export a repeatable-read snapshot, native `pg_dump`/`pg_restore`, compare all public table rows/schema, replay a restored receipt without new effects, preserve source and account for the deliberately acknowledged post-snapshot write |

The Redis case also runs the production `HealthController.ready()` method with
actual PostgreSQL, Redis, Mongo and local S3 probes. A **harness** loopback HTTP
adapter/proxy must preserve 200 → 503 → 200. A separate loopback HTTP witness
records a sanitized alert receipt in PostgreSQL while Redis is stopped. This is
proof of that local path, **not** a deployed Nest AppModule/proxy or a real
external alert provider. Redis delivery uses real scoped LIST commands, **not**
the application's BullMQ processors. No claim of full-stack queue acceptance.

The external adapter is explicitly synthetic and stores one separate durable
resource in the protected fixture schema. It is not Printify sandbox evidence,
even though the real external-intent transaction/SQL guards are exercised.
No raw driver exception, email, payload, cookie, DSN, dump or secret is logged.

## Safety and prerequisites

1. Node `>=24.15.0 <25`, local Docker daemon/context, digest-pinned owned stack
   from `docker/m5/compose.yml`; no remote Docker or ambient startup/route override.
2. The strict private `.env.m5.local` manifest: loopback-only synthetic endpoints,
   empty provider credentials, TEST provenance, all production gates off.
3. Completed native M5.1 and M5.2 reports matching the current source and original
   migration hashes. Previous reports become stale after a candidate change.
4. Read-only identity/fixture revalidation of both foundation databases, protected
   nonce in the scenario database, complete original migration history, and no
   non-TEST economic context in that database.
5. Parent owns a PostgreSQL advisory lock through child exit and independent
   cleanup. Only the owned child handle can be killed, after IPC confirms run,
   nonce, phase, resource, process PID and actual PostgreSQL backend PID.
6. Redis stop/start revalidates the original full container ID, project/service
   labels, pinned image, isolated network and loopback ports. No global process
   kill, volume prune, table reset, migration rewrite, source restore or deletion.

Cleanup restarts that same Redis container in the child `finally` and again in
the parent after an observed child exit/watchdog. If the orchestrator itself is
forcibly killed, its `finally` cannot run: operator recovery remains necessary.
Use the guarded `api:m5-up`, inspect the failed report/retained fixtures, and
rerun with a new run ID. Do not reset data to erase a failed test.

The sole privileged database connection is the nonce-checked local bootstrap
role, used to create a **new** `ezihubb_m5_restore_<24-hex-run-id>` database and
its protected marker. Existing targets are rejected, never overwritten. The
application restore connection is non-superuser/non-createdb/non-createrole.
If the archive creates `public`, the fresh template's empty namespace is renamed
to `m5_empty_public` after checking it is empty, not dropped.

## Backup, reconciliation and measurements

- Native custom-format dump is bounded at 128 MiB, SHA-256 checked before restore,
  scoped to public PostgreSQL objects and retained under ignored
  `tmp/m5/recovery-<run-id>/snapshot.dump`. File mode is 0600, directory mode 0700
  where the OS supports POSIX modes; these are **not Windows ACL guarantees**.
  Only synthetic fixtures are allowed. Never upload the dump or private manifest.
- Source hashes are collected in the **same exported MVCC snapshot** supplied to
  `pg_dump`. All public rows, including money, reservations, receipts and migration
  history, are compared as per-table row hashes/counts. Schema comparison includes
  columns/defaults, constraints, triggers, functions, indexes, enums, views and
  sequence state. Exact equality is required before and after receipt replay.
- Source data is not restored/deleted. Post-backup source hashes must remain
  unchanged during restore. The destination/backup remain available for inspection.
- One synthetic product write is acknowledged after the snapshot. It must exist
  in the source and be absent from the restored snapshot. Report
  `missingAcknowledgements: 1` and `observedRpoMs` as the measured database-clock
  gap between snapshot and last acknowledged write. This is **backup-only loss**,
  not WAL replay, a promised RPO objective, or proof that real payments are recovered.
- `restoreAndReconcileRtoMs` uses a monotonic timer from destination provisioning
  through native restore and reconciliation. `serviceRtoMs` stays **null**;
  no application restart/browser checkout or traffic cutover is measured.

Sanitized JSON reports remain under ignored `artifacts/m5/`. A local native PASS
may set `recoveryVerified: true`; it must still retain `fullStackVerified: false`,
`milestoneComplete: false`, `productionActivated: false`, `providerOperations: false`.
Reports are local unsigned evidence, not independent remote attestation.

## Run sequence

```powershell
pnpm nx run api:m5-recovery-test --skipNxCache
pnpm nx run api:m5-lint --skipNxCache
pnpm nx run api:m5-typecheck --skipNxCache
# On the authorized local Docker/Node baseline, re-run current-source prerequisites:
pnpm nx run api:m5-verify --skipNxCache
pnpm nx run api:m5-contention --skipNxCache
pnpm nx run api:m5-recovery-doctor --skipNxCache
pnpm nx run api:m5-recovery --skipNxCache
```

The manual foundation CI workflow now includes recovery contracts and the native
local drill after native foundation/contention. It uploads only sanitized JSON,
not the dump. This workflow has **not** been dispatched here.

## Remaining milestone acceptance (fixed, not hidden)

| Required evidence | Current status |
| --- | --- |
| Eight native local cases and measured backup-only loss/restore time | Implemented; NOT RUN: Node 24.14, missing Docker/manifest and completed current-source native M5.1/M5.2 evidence |
| Deployed coordinated API/worker crash boundaries with actual BullMQ/provider/DB acknowledgement failures | Still requires full-stack drivers from M5.3; local subprocess functions do not prove this |
| Actual staging reverse proxy readiness failure and independently delivered operational alert | Local adapter/witness implemented; deployed topology/alert integration unverified |
| Whole-system Redis/Mongo/object storage/mailbox recovery plus verified application restart | PostgreSQL/public-only restore and Redis restart are narrower; remaining restore drivers unimplemented/unverified |
| Provider-created resources absent from restored DB, independent reconciliation before redispatch/traffic | Synthetic lookup case only; actual sandbox reconciliation depends on M5.3 and is unverified |
| RPO/RTO objective agreement, WAL/PITR if zero acknowledged-payment loss is required, service recovery timing | No numerical objective was supplied/claimed; backup-only loss is deliberately exposed, not accepted as zero-loss |
| M5.3 closure and separate M5.5 release/pilot decision | Not complete; no live/deploy approval inferred |

Contract tests may PASS without Docker. They include real unit-level child kills
and loopback HTTP, but fake backend IDs/controller/query models are explicitly
marked UNIT and are never stored as native evidence. Failed development runs do
not count toward acceptance.

Measured local verification: `api:m5-recovery-test` **16/16 PASS** (11.921 s),
M5 lint **0 warnings / 0 errors**, M5 typecheck and diff check PASS. Foundation
contracts **39/39**, contention contracts **10/10** PASS. These counts do not
claim a native recovery run or provider/full-stack acceptance. Doctor remains
BLOCKED before database/container I/O; no native case or backup was run here.
