const { randomBytes } = require('node:crypto');
const { readFileSync, lstatSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { assertRuntime, assertEnvironment, parseEnv, cleanChildEnvironment, assertDatabaseIdentity, SCENARIO_DATABASE, migrationManifest } = require('./guard.cjs');
const { sourceChecksums, findFoundationEvidence, findContentionEvidence } = require('./evidence.cjs');
const { ROOT, dockerContext, ownedContainers, inspectOwned, redisAction, assertRecoveryEvidence } = require('./recovery-support.cjs');
const report = { version: 'm5.4-v1', runId: randomBytes(12).toString('hex'), startedAt: new Date().toISOString(),
  scope: 'LOCAL_SYNTHETIC_RECOVERY_ONLY', steps: [], productionActivated: false, providerOperations: false,
  recoveryVerified: false, fullStackVerified: false, milestoneComplete: false, sourceChecksums: sourceChecksums(ROOT) };
const codeOf = error => /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_RECOVERY_FAILED';
function check(name, work) {
  try { const value = work(); report.steps.push({ name, outcome: 'PASS' }); return value; }
  catch (error) { report.steps.push({ name, outcome: 'BLOCKED', code: codeOf(error) }); return undefined; }
}
async function main() {
  report.action = process.argv[2];
  if (process.argv.length !== 3 || !['doctor', 'drill'].includes(report.action)) throw new Error('M5_ACTION');
  check('runtime-baseline', () => assertRuntime());
  report.migrations = migrationManifest(ROOT);
  const foundationId = check('accepted-native-foundation', () => findFoundationEvidence(ROOT, report.sourceChecksums, report.migrations));
  const contentionId = check('accepted-native-contention', () => {
    if (!foundationId) throw new Error('M5_FOUNDATION_EVIDENCE_REQUIRED');
    return findContentionEvidence(ROOT, report.sourceChecksums, report.migrations, foundationId);
  });
  const env = check('private-synthetic-manifest', () => {
    const file = resolve(ROOT, '.env.m5.local');
    if (!existsSync(file)) throw new Error('M5_MANIFEST_MISSING');
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384) throw new Error('M5_MANIFEST_INVALID');
    return assertEnvironment(parseEnv(readFileSync(file, 'utf8')));
  });
  // No daemon operation, DB connection or failure injection without all prerequisites.
  if (report.steps.some(row => row.outcome === 'BLOCKED')) { report.outcome = 'BLOCKED'; return; }
  report.foundationRunId = foundationId; report.contentionRunId = contentionId;
  const context = check('local-docker-context-and-compose', () => dockerContext(env));
  if (!context) { report.outcome = 'BLOCKED'; return; }
  const containers = check('owned-running-containers', () => ownedContainers(context, env));
  if (report.steps.some(row => row.outcome === 'BLOCKED') || report.action === 'doctor') return;
  const { Pool } = require('pg');
  const coordination = new Pool({ connectionString: cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL, max: 1,
    connectionTimeoutMillis: 5000, options: '-c statement_timeout=60000 -c lock_timeout=10000' });
  let ownedLock = false;
  let result;
  try {
    await assertDatabaseIdentity(coordination, env, SCENARIO_DATABASE);
    ownedLock = (await coordination.query("SELECT pg_try_advisory_lock(hashtext('m5.4-local-recovery-v1')) AS locked")).rows[0].locked;
    if (!ownedLock) throw new Error('M5_RECOVERY_ALREADY_RUNNING');
    result = await new Promise((yes, no) => {
    const child = spawn(process.execPath, ['--import', 'tsx', resolve(ROOT, 'scripts/m5/recovery.ts'), report.runId, foundationId, contentionId],
      { cwd: ROOT, env: { ...cleanChildEnvironment(env, SCENARIO_DATABASE), TSX_TSCONFIG_PATH: resolve(ROOT, 'scripts/m5/recovery-runtime.tsconfig.json') },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', size = 0, aborted = false;
    child.stdout.on('data', bytes => { size += bytes.length; if (size > 1024 * 1024) { aborted = true; child.kill('SIGKILL'); } else output += bytes; });
    child.stderr.resume(); // Never echo credentials/driver data.
    // Child implements its own bounded operations + Redis restart in finally.
    // A watchdog is not a recovery result; any abnormal exit fails the gate.
    const timer = setTimeout(() => { aborted = true; child.kill('SIGKILL'); }, 600_000);
    child.on('error', () => { clearTimeout(timer); no(new Error('M5_RECOVERY_CHILD')); });
    child.on('close', code => {
      clearTimeout(timer);
      try { if (aborted || code !== 0) throw new Error('M5_RECOVERY_CHILD'); yes(JSON.parse(output)); }
      catch { no(new Error('M5_RECOVERY_CHILD')); }
    });
  }); } finally {
    // Independent cleanup also runs after watchdog/child failure: revalidate the
    // same container ID before restart, never target another service/container.
    try {
      if (ownedLock) {
        const state = inspectOwned(context, env, containers.redis, 'redis');
        if (!state.State?.Running) redisAction(context, env, containers.redis, 'start');
        ownedContainers(context, env);
        report.steps.push({ name: 'owned-stack-running-after-child', outcome: 'PASS' });
      }
    } finally {
      if (ownedLock) await coordination.query("SELECT pg_advisory_unlock(hashtext('m5.4-local-recovery-v1'))").catch(() => undefined);
      await coordination.end();
    }
  }
  if (result.outcome !== 'PASS') {
    if (require('./recovery-contract.json').includes(result.failedCase)) report.steps.push({ name: result.failedCase, outcome: 'FAIL' });
    throw new Error('M5_RECOVERY_CASE_FAILED');
  }
  assertRecoveryEvidence(result, report.runId, foundationId, contentionId);
  if (JSON.stringify(sourceChecksums(ROOT)) !== JSON.stringify(report.sourceChecksums)) throw new Error('M5_RECOVERY_CANDIDATE_CHANGED');
  report.cases = result.cases; report.restore = result.restore;
  report.recoveryVerified = true;
  report.steps.push({ name: 'native-local-failure-and-restore', outcome: 'PASS' });
}
main().catch(error => { report.outcome = 'BLOCKED'; report.steps.push({ name: 'recovery', outcome: 'BLOCKED', code: codeOf(error) }); })
  .finally(() => {
    report.outcome ??= report.steps.some(row => row.outcome === 'BLOCKED') ? 'BLOCKED' : 'PASS';
    report.completedAt = new Date().toISOString(); mkdirSync(resolve(ROOT, 'artifacts/m5'), { recursive: true });
    const reportFile = `artifacts/m5/${report.runId}.json`;
    writeFileSync(resolve(ROOT, reportFile), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ version: report.version, action: report.action, outcome: report.outcome, reportFile,
      recoveryVerified: report.recoveryVerified, milestoneComplete: false, steps: report.steps }, null, 2));
    process.exitCode = report.outcome === 'PASS' ? 0 : 1;
  });
