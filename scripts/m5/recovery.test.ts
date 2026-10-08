import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertHandshake, killAcknowledgedChild, eventually, PHASES } from './recovery-process';
import { databaseSnapshot } from './recovery-restore';
import { scopedEventClient } from './recovery';
import { readinessGateway } from './recovery-readiness';
import { ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import names from './recovery-contract.json';
const { restoreDatabase, assertRecoveryContainer, assertSnapshotEqual, measureRestore, assertRecoveryEvidence, MAX_BACKUP_BYTES, archiveCreatesPublicSchema } = require('./recovery-support.cjs');
const { PROJECT, IMAGES, PORTS } = require('./guard.cjs');
const runId = 'a'.repeat(24), foundationId = 'b'.repeat(24), contentionId = 'c'.repeat(24);
const expected = { runId, nonce: 'd'.repeat(48), phase: 'before-commit' as const, pid: 100, resourceId: 'Ab0123456789' };
const message = { ...expected, kind: 'm5-recovery-barrier-v1', backendPid: 200 };

test('fixed eight-case contract maps to actual native execution, not a skipped drill', () => {
  assert.equal(names.length, 8); assert.equal(new Set(names).size, 8);
  const worker = readFileSync(resolve(__dirname, 'recovery-worker.ts'), 'utf8');
  for (const phase of PHASES.filter(phase => phase !== 'after-commit')) assert(worker.includes(`phase === '${phase}'`));
  for (const file of ['recovery.ts', 'recovery-worker.ts', 'recovery-restore.ts', 'recovery-support.cjs']) {
    const source = readFileSync(resolve(__dirname, file), 'utf8');
    assert(!/\bDROP\s|\bTRUNCATE\s|deleteMany\(|process\.kill\(|taskkill|rm -rf|pg_restore[^\n]*--clean/i.test(source));
  }
});
test('restore target cannot be caller-selected, production, old fixture or SQL injection', () => {
  assert.equal(restoreDatabase(runId), `ezihubb_m5_restore_${runId}`);
  for (const id of ['production', '../prod', `${runId}; DROP DATABASE x`, 'A'.repeat(24), '', 'a'.repeat(23)]) {
    assert.throws(() => restoreDatabase(id), /M5_RECOVERY_IDENTITY/);
  }
});
test('process barrier rejects another run, nonce, process, resource, phase and fake backend proof', () => {
  assert.equal(assertHandshake(message, expected), 200);
  for (const change of [{ runId: foundationId }, { nonce: 'z' }, { pid: 101 }, { resourceId: 'WrongScope12' },
    { phase: 'after-commit' }, { backendPid: 0 }, { backendPid: '200' }, { kind: 'unknown' }]) {
    assert.throws(() => assertHandshake({ ...message, ...change }, expected), /M5_RECOVERY_HANDSHAKE/);
  }
  assert.throws(() => assertHandshake(null, expected));
});
test('actual owned child is killed only after IPC proof and observed exit (UNIT IPC, no native database)', async () => {
  const source = `const data=${JSON.stringify({ ...message, pid: undefined })}; data.pid=process.pid; process.send(data); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['-e', source], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const result = await killAcknowledgedChild(child, expected);
  assert.equal(result.killedPid, child.pid); assert.equal(result.backendPid, 200); assert.equal(result.exitObserved, true);
  assert.notEqual(child.exitCode, 0);
});
test('wrong-identity IPC never passes as the intended crash boundary (UNIT IPC)', async () => {
  const source = `const data=${JSON.stringify({ ...message, nonce: 'wrong' })}; data.pid=process.pid; process.send(data); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['-e', source], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  await assert.rejects(killAcknowledgedChild(child, expected), /M5_RECOVERY_HANDSHAKE/);
});
test('normal early child exit cannot count as a killed commit boundary (UNIT IPC)', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  await assert.rejects(killAcknowledgedChild(child, expected), /M5_RECOVERY_EARLY_EXIT/);
});
function container(service = 'redis') {
  return { Id: 'e'.repeat(64), Config: { Image: IMAGES[service], Labels: { 'com.docker.compose.project': PROJECT, 'com.docker.compose.service': service } },
    HostConfig: { Privileged: false, NetworkMode: `${PROJECT}_isolated`,
      PortBindings: Object.fromEntries(Object.entries(PORTS[service]).map(([port, number]) => [port, [{ HostIp: '127.0.0.1', HostPort: number }]])) } };
}
test('Redis restart requires original full container identity, scoped image, network and loopback binding', () => {
  const owned = container(); assertRecoveryContainer(owned, owned.Id, 'redis');
  for (const changed of [{ ...owned, Id: 'f'.repeat(64) }, { ...owned, Config: { ...owned.Config, Image: 'redis:latest' } },
    { ...owned, Config: { ...owned.Config, Labels: { ...owned.Config.Labels, 'com.docker.compose.project': 'production' } } },
    { ...owned, HostConfig: { ...owned.HostConfig, NetworkMode: 'host' } },
    { ...owned, HostConfig: { ...owned.HostConfig, Privileged: true } },
    { ...owned, HostConfig: { ...owned.HostConfig, PortBindings: { '6379/tcp': [{ HostIp: '0.0.0.0', HostPort: '6379' }] } } }]) {
    assert.throws(() => assertRecoveryContainer(changed, owned.Id, 'redis'));
  }
  assert.throws(() => assertRecoveryContainer(owned, owned.Id, 'mongo'));
});
test('snapshot equality rejects even one money/inventory/receipt/schema difference', () => {
  const snapshot = { tables: [{ name: 'EconomicJournalEntry', count: 2, sha256: 'a'.repeat(64) }], schemaHash: 'b'.repeat(64) };
  assertSnapshotEqual(snapshot, structuredClone(snapshot));
  for (const changed of [{ ...snapshot, schemaHash: 'c'.repeat(64) }, { ...snapshot, tables: [] },
    { ...snapshot, tables: [{ ...snapshot.tables[0], count: 1 }] }, { ...snapshot, tables: [{ ...snapshot.tables[0], sha256: 'd'.repeat(64) }] }]) {
    assert.throws(() => assertSnapshotEqual(snapshot, changed), /M5_RESTORE_SNAPSHOT_MISMATCH/);
  }
});
test('restore preserves a fresh template public namespace only when the native archive creates one', () => {
  const heading = '; Archive created at 2026-10-08\n';
  assert.equal(archiveCreatesPublicSchema(heading + '6; 2615 2200 SCHEMA - public ezihubb_m5\n'), true);
  assert.equal(archiveCreatesPublicSchema(heading + '10; 0 0 COMMENT - SCHEMA public ezihubb_m5\n'), false);
  assert.throws(() => archiveCreatesPublicSchema('unknown'), /M5_RESTORE_ARCHIVE_LIST/);
});
test('observed snapshot-only RPO exposes lost ACK, and RTO never pretends the service restarted', () => {
  const result = measureRestore({ snapshotAt: '2026-10-08T00:00:00.000Z', lastAcknowledgedAt: '2026-10-08T00:00:02.500Z', missingAcknowledgements: 1, rtoMs: 3000.4 });
  assert.equal(result.observedRpoMs, 2500); assert.equal(result.missingAcknowledgements, 1);
  assert.equal(result.restoreAndReconcileRtoMs, 3001); assert.equal(result.serviceRtoMs, null);
  for (const change of [{ rtoMs: -1 }, { rtoMs: NaN }, { snapshotAt: 'unknown' }, { lastAcknowledgedAt: '2026-10-07T00:00:00.000Z' },
    { missingAcknowledgements: -1 }, { missingAcknowledgements: 0 }]) {
    assert.throws(() => measureRestore({ ...result, rtoMs: 1, ...change }), /M5_RECOVERY_MEASUREMENT/);
  }
});
function evidence() {
  return { version: 'm5.4-cases-v1', outcome: 'PASS', runId, foundationId, contentionId,
    scope: 'LOCAL_SYNTHETIC_RECOVERY_ONLY', fullStack: false, providerOperations: false,
    cases: names.map(name => ({ name, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: 1,
      killedPid: 101, backendPid: 201, exitObserved: true })),
    restore: { database: restoreDatabase(runId), backupSha256: 'f'.repeat(64), backupBytes: 1000,
      snapshotHash: 'a'.repeat(64), scope: 'PUBLIC_POSTGRES_SCHEMA_ONLY_NOT_REDIS_MONGO_STORAGE', retainedPrivateBackup: true,
      snapshotMatched: true, replayDeduplicated: true, sourcePreserved: true,
      metrics: measureRestore({ snapshotAt: '2026-10-08T00:00:00.000Z', lastAcknowledgedAt: '2026-10-08T00:00:01.000Z', missingAcknowledgements: 1, rtoMs: 1000 }) } };
}
test('recovery acceptance requires all eight native cases, killed process proof and exact restore', () => {
  const report = evidence(); assertRecoveryEvidence(report, runId, foundationId, contentionId);
  for (const changed of [{ ...report, outcome: 'BLOCKED' }, { ...report, providerOperations: true }, { ...report, fullStack: true },
    { ...report, contentionId: runId }, { ...report, cases: report.cases.slice(1) },
    { ...report, cases: report.cases.map(row => ({ ...row, exitObserved: false })) },
    { ...report, cases: report.cases.map(row => ({ ...row, backendPid: 0 })) },
    { ...report, restore: { ...report.restore, sourcePreserved: false } }, { ...report, restore: { ...report.restore, database: 'production' } },
    { ...report, restore: { ...report.restore, backupBytes: MAX_BACKUP_BYTES + 1 } },
    { ...report, restore: { ...report.restore, metrics: { ...report.restore.metrics, observedRpoMs: 0 } } }]) {
    assert.throws(() => assertRecoveryEvidence(changed, runId, foundationId, contentionId));
  }
});
test('candidate selection narrows the outbox to the owned event without replacing CAS logic (UNIT model)', async () => {
  let where: unknown;
  const client = { economicOutbox: { findFirst: async (input: { where: unknown }) => { where = input.where; return null; },
    updateMany: async () => ({ count: 1 }) } } as unknown as PrismaClient;
  const scoped = scopedEventClient(client, expected.resourceId);
  await scoped.economicOutbox.findFirst({ where: { state: 'PENDING' } });
  assert.deepEqual(where, { AND: [{ state: 'PENDING' }, { id: expected.resourceId }] });
  assert.deepEqual(await scoped.economicOutbox.updateMany({ data: { state: 'CLAIMED' } }), { count: 1 });
});
test('native snapshot collector rejects unsafe relation and oversized table before reading data (UNIT query model)', async () => {
  const unsafe = { query: async () => ({ rows: [{ tablename: 'bad";DROP' }] }) } as unknown as Pool;
  await assert.rejects(databaseSnapshot(unsafe), /M5_RESTORE_RELATION/);
  const huge = { query: async (sql: string) => sql.includes('pg_tables') ? { rows: [{ tablename: 'Order' }] } : { rows: [{ count: 100_001 }] } } as unknown as Pool;
  await assert.rejects(databaseSnapshot(huge), /M5_RESTORE_SIZE_LIMIT/);
});
test('recovery polling is bounded and only counts an observed successful condition (UNIT model)', async () => {
  let attempts = 0;
  assert.equal(await eventually(async () => ++attempts, value => value === 2, 500), 2);
  await assert.rejects(eventually(async () => { throw new Error('offline'); }, () => true, 1), /M5_RECOVERY_CONDITION_TIMEOUT/);
});
test('loopback proxy preserves readiness 503/200 and independent HTTP witness ACK (UNIT controller model)', async () => {
  let degraded = true, delivered = 0;
  const gateway = await readinessGateway({ ready: async () => {
    if (degraded) throw new ServiceUnavailableException();
    return { status: 'ok', timestamp: '', services: { database: 'ok', redis: 'ok', mongodb: 'ok', storage: 'ok' },
      probes: { database: '', redis: '', mongodb: '', storage: '' }, version: '' };
  } }, async payload => { assert.deepEqual(payload, { code: 'ERR_NOT_READY', scope: 'M5_LOCAL_SYNTHETIC' }); delivered++; });
  try {
    assert.equal(await gateway.readyStatus(), 503); assert.equal(await gateway.alertStatus(), 202); assert.equal(delivered, 1);
    degraded = false; assert.equal(await gateway.readyStatus(), 200);
  } finally { await gateway.close(); }
});
test('failed independent alert sink cannot falsely ACK delivery (UNIT controller model)', async () => {
  const gateway = await readinessGateway({ ready: async () => { throw new ServiceUnavailableException(); } },
    async () => { throw new Error('not recorded'); });
  try { assert.equal(await gateway.alertStatus(), 503); } finally { await gateway.close(); }
});
