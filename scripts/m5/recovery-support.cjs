const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { PROJECT, IMAGES, PORTS, cleanChildEnvironment, assertDockerEndpoint, assertComposeConfig, assertOwnedContainers } = require('./guard.cjs');

const ROOT = resolve(__dirname, '../..');
const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
function runIdentity(value) {
  if (!/^[a-f0-9]{24}$/.test(value ?? '')) throw new Error('M5_RECOVERY_IDENTITY');
  return value;
}
function restoreDatabase(runId) { return `ezihubb_m5_restore_${runIdentity(runId)}`; }
function command(args, env, input) {
  const result = spawnSync('docker', args, { cwd: ROOT, env: cleanChildEnvironment(env),
    input, timeout: 120_000, maxBuffer: MAX_BACKUP_BYTES, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('M5_RECOVERY_DOCKER_COMMAND');
  // Binary dumps and driver diagnostics never go to console/report.
  return result.stdout;
}
function dockerContext(env, isolatedChild = false) {
  if (['DOCKER_HOST', 'DOCKER_CONTEXT', 'COMPOSE_FILE', 'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS']
    .some(key => process.env[key])) throw new Error('M5_AMBIENT_RECOVERY_OVERRIDE');
  if (process.env.COMPOSE_PROJECT_NAME && !(isolatedChild && process.env.COMPOSE_PROJECT_NAME === PROJECT)) throw new Error('M5_AMBIENT_RECOVERY_OVERRIDE');
  const context = command(['context', 'show'], env).toString().trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(context)) throw new Error('M5_DOCKER_CONTEXT');
  assertDockerEndpoint(JSON.parse(command(['context', 'inspect', context], env).toString()));
  const config = JSON.parse(command(['--context', context, 'compose', '--project-name', PROJECT,
    '--env-file', resolve(ROOT, '.env.m5.local'), '--file', resolve(ROOT, 'docker/m5/compose.yml'), 'config', '--format', 'json'], env).toString());
  assertComposeConfig(config, ROOT);
  return context;
}
function ownedContainers(context, env) {
  const ids = command(['--context', context, 'compose', '--project-name', PROJECT,
    '--env-file', resolve(ROOT, '.env.m5.local'), '--file', resolve(ROOT, 'docker/m5/compose.yml'), 'ps', '-q'], env).toString().trim().split(/\s+/);
  if (ids.length !== 5 || ids.some(id => !/^[a-f0-9]{12,64}$/.test(id))) throw new Error('M5_STACK_NOT_RUNNING');
  const containers = JSON.parse(command(['--context', context, 'inspect', ...ids], env).toString());
  assertOwnedContainers(containers);
  return Object.fromEntries(containers.map(row => [row.Config.Labels['com.docker.compose.service'], row.Id]));
}
function assertRecoveryContainer(row, id, service) {
  if (!['redis', 'postgres'].includes(service) || !/^[a-f0-9]{64}$/.test(id)
    || row.Id !== id || row.Config?.Image !== IMAGES[service]
    || row.Config?.Labels?.['com.docker.compose.project'] !== PROJECT
    || row.Config?.Labels?.['com.docker.compose.service'] !== service) throw new Error('M5_RECOVERY_CONTAINER_IDENTITY');
  const bindings = row.HostConfig?.PortBindings ?? {};
  assert.deepEqual(Object.keys(bindings).sort(), Object.keys(PORTS[service]).sort());
  for (const [port, number] of Object.entries(PORTS[service])) {
    assert.deepEqual(bindings[port], [{ HostIp: '127.0.0.1', HostPort: number }]);
  }
  if (row.HostConfig?.Privileged || row.HostConfig?.NetworkMode !== `${PROJECT}_isolated`) throw new Error('M5_RECOVERY_CONTAINER_IDENTITY');
  return row;
}
function inspectOwned(context, env, id, service) {
  const rows = JSON.parse(command(['--context', context, 'inspect', id], env).toString());
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('M5_RECOVERY_CONTAINER_IDENTITY');
  return assertRecoveryContainer(rows[0], id, service);
}
function redisAction(context, env, id, action) {
  if (!['stop', 'start'].includes(action)) throw new Error('M5_RECOVERY_ACTION');
  const row = inspectOwned(context, env, id, 'redis');
  if (action === 'stop' && row.State?.Running !== true) throw new Error('M5_STACK_NOT_RUNNING');
  command(['--context', context, action, ...(action === 'stop' ? ['--time', '2'] : []), id], env);
}
function snapshotHash(tables) { return createHash('sha256').update(JSON.stringify(tables)).digest('hex'); }
function archiveCreatesPublicSchema(listing) {
  if (typeof listing !== 'string' || listing.length > 1024 * 1024 || !listing.includes('; Archive created at')) throw new Error('M5_RESTORE_ARCHIVE_LIST');
  return listing.split(/\r?\n/).some(line => /^\d+; \d+ \d+ SCHEMA - public [A-Za-z0-9_]+$/.test(line.trim()));
}
function assertSnapshotEqual(expected, actual) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('M5_RESTORE_SNAPSHOT_MISMATCH');
}
function measureRestore({ snapshotAt, lastAcknowledgedAt, missingAcknowledgements, rtoMs }) {
  const point = Date.parse(snapshotAt), last = Date.parse(lastAcknowledgedAt);
  if (!Number.isFinite(point) || !Number.isFinite(last) || last < point || !Number.isSafeInteger(missingAcknowledgements)
    || missingAcknowledgements < 0 || !Number.isFinite(rtoMs) || rtoMs < 0
    || (missingAcknowledgements === 0 && last !== point)) throw new Error('M5_RECOVERY_MEASUREMENT');
  return { basis: 'POSTGRES_EXPORTED_SNAPSHOT_NO_WAL_REPLAY', snapshotAt, lastAcknowledgedAt,
    missingAcknowledgements, observedRpoMs: missingAcknowledgements ? last - point : 0,
    restoreAndReconcileRtoMs: Math.ceil(rtoMs), serviceRtoMs: null };
}
function assertRecoveryEvidence(result, runId, foundationId, contentionId) {
  const names = require('./recovery-contract.json');
  if (result?.version !== 'm5.4-cases-v1' || result.outcome !== 'PASS' || result.runId !== runId
    || result.foundationId !== foundationId || result.contentionId !== contentionId
    || result.scope !== 'LOCAL_SYNTHETIC_RECOVERY_ONLY' || result.fullStack !== false || result.providerOperations !== false
    || JSON.stringify(result.cases?.map(row => row.name)) !== JSON.stringify(names)
    || result.cases.some(row => row.outcome !== 'PASS' || row.assertions !== 'NATIVE_EFFECTS_AND_RECOVERY'
      || !Number.isFinite(row.durationMs) || row.durationMs < 0)
    || result.restore?.database !== restoreDatabase(runId) || !/^[a-f0-9]{64}$/.test(result.restore?.backupSha256 ?? '')
    || !/^[a-f0-9]{64}$/.test(result.restore?.snapshotHash ?? '')
    || result.restore?.snapshotMatched !== true || result.restore?.replayDeduplicated !== true
    || result.restore?.sourcePreserved !== true || !Number.isSafeInteger(result.restore?.backupBytes) || result.restore?.backupBytes < 1
    || result.restore?.backupBytes > MAX_BACKUP_BYTES || result.restore?.metrics?.missingAcknowledgements !== 1
    || result.restore?.scope !== 'PUBLIC_POSTGRES_SCHEMA_ONLY_NOT_REDIS_MONGO_STORAGE'
    || result.restore?.retainedPrivateBackup !== true) {
    throw new Error('M5_RECOVERY_INCOMPLETE');
  }
  for (const row of result.cases.slice(0, 6)) {
    if (!Number.isSafeInteger(row.killedPid) || row.killedPid < 1 || row.exitObserved !== true
      || !Number.isSafeInteger(row.backendPid) || row.backendPid < 1) throw new Error('M5_RECOVERY_INCOMPLETE');
  }
  const { metrics } = result.restore;
  assert.deepEqual(metrics, measureRestore({ ...metrics, rtoMs: metrics.restoreAndReconcileRtoMs }));
  return result;
}
module.exports = { ROOT, MAX_BACKUP_BYTES, runIdentity, restoreDatabase, command, dockerContext, ownedContainers,
  assertRecoveryContainer, inspectOwned, redisAction, snapshotHash, assertSnapshotEqual, measureRestore, assertRecoveryEvidence };
module.exports.archiveCreatesPublicSchema = archiveCreatesPublicSchema;
