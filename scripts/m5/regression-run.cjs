const { randomBytes } = require('node:crypto');
const { mkdirSync, writeFileSync, createWriteStream, readFileSync, lstatSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { performance } = require('node:perf_hooks');
const { sourceChecksums } = require('./evidence.cjs');
const { migrationManifest } = require('./guard.cjs');
const { releaseFingerprint, assertArtifactPath } = require('./release.cjs');
const { TASKS, SCOPE, assertCleanCheckout, assertRegressionRuntime, regressionEnvironment, taskArguments,
  assertResolvedProject, apiTestInventory, readJestSummary, assertRegressionEvidence, sha256 } = require('./regression.cjs');
const root = resolve(__dirname, '../..');
const report = { version: 'm5.5-regression-v1', runId: randomBytes(12).toString('hex'), startedAt: new Date().toISOString(),
  scope: SCOPE, tasks: [], steps: [], runtime: { node: process.versions.node, platform: process.platform },
  regressionVerified: false, browserVerified: false, nativeVerified: false, providerOperations: false,
  productionActivated: false, milestoneComplete: false };
const codeOf = error => /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_REGRESSION_FAILED';
function check(name, work) {
  try { const result = work(); report.steps.push({ name, outcome: 'PASS' }); return result; }
  catch (error) { report.steps.push({ name, outcome: 'BLOCKED', code: codeOf(error) }); }
}
function command(args, env, logFile, capture = false) {
  return new Promise((yes, no) => {
    const log = createWriteStream(logFile, { flags: 'wx', mode: 0o600 });
    const child = spawn('pnpm', args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let size = 0, stdout = '', failed = false;
    const killGroup = () => {
      // Only the group created by this still-owned spawn; never caller input.
      if (Number.isSafeInteger(child.pid) && child.pid > 1) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
      }
    };
    const timer = setTimeout(() => { failed = true; killGroup(); }, 30 * 60_000);
    function bytes(data, isStdout) {
      size += data.length;
      if (size > (capture ? 4 : 100) * 1024 * 1024) { failed = true; killGroup(); return; }
      log.write(data);
      if (capture && isStdout) stdout += data.toString();
    }
    child.stdout.on('data', data => bytes(data, true)); child.stderr.on('data', data => bytes(data, false));
    log.on('error', () => { failed = true; killGroup(); });
    child.on('error', () => { failed = true; });
    child.on('close', exitCode => {
      clearTimeout(timer); // Never signal a PID/group after its observed exit.
      log.end(() => {
        if (failed || exitCode !== 0) { no(new Error('M5_REGRESSION_TASK_FAILED')); return; }
        yes({ exitCode, stdout, logSha256: sha256(readFileSync(logFile)) });
      });
    });
  });
}
async function main() {
  report.action = process.argv[2];
  if (process.argv.length !== 3 || !['doctor', 'run'].includes(report.action)) throw new Error('M5_REGRESSION_ACTION');
  const fingerprint = releaseFingerprint(root);
  report.candidate = { sha256: fingerprint.sha256, fileCount: fingerprint.fileCount };
  report.sourceChecksums = sourceChecksums(root); report.migrations = migrationManifest(root);
  check('runtime-and-owned-linux-process-groups', () => assertRegressionRuntime());
  check('no-private-env-autoload', () => assertCleanCheckout(root));
  if (report.steps.some(row => row.outcome === 'BLOCKED')) { report.outcome = 'BLOCKED'; return; }
  if (report.action === 'doctor') return;
  const directory = resolve(root, `tmp/m5/regression-${report.runId}`);
  // Validate parent links before creating any private output directory.
  for (const ancestor of ['tmp', 'tmp/m5']) {
    try { const info = lstatSync(resolve(root, ancestor)); if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('M5_REGRESSION_OUTPUT_LINK'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(directory, 'network-denials.txt'), '', { flag: 'wx', mode: 0o600 });
  const fixture = createServer((_request, response) => {
    response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end('{"success":false,"error":{"code":"M5_STATIC_BUILD_FIXTURE_NOT_REAL_API"}}');
  });
  await new Promise((yes, no) => { fixture.once('error', no); fixture.listen(0, '127.0.0.1', yes); });
  try {
    const port = fixture.address().port, env = regressionEnvironment(root, port, directory);
    report.fixture = { mode: 'STATIC_BUILD_503_NOT_REAL_API' };
    report.networkPolicy = 'OWNED_LOOPBACK_AND_GOOGLE_FONT_DOWNLOADS_ONLY';
    for (const name of ['api', 'admin', 'client']) {
      const result = await command(['nx', 'show', 'project', name, '--json'], env, resolve(directory, `${name}-config.log`), true);
      assertResolvedProject(JSON.parse(result.stdout), name);
    }
    report.steps.push({ name: 'resolved-nx-targets-and-original-budgets', outcome: 'PASS' });
    const inventory = apiTestInventory(root);
    for (const task of TASKS) {
      assertCleanCheckout(root);
      if (releaseFingerprint(root).sha256 !== fingerprint.sha256) throw new Error('M5_REGRESSION_CANDIDATE_CHANGED');
      const start = performance.now();
      try {
        const result = await command(taskArguments(task, directory), env, resolve(directory, `${task.replaceAll(':', '-')}.log`));
        report.tasks.push({ task, outcome: 'PASS', exitCode: result.exitCode, cached: false,
          durationMs: Math.ceil(performance.now() - start), logSha256: result.logSha256 });
      } catch (error) {
        report.tasks.push({ task, outcome: 'FAIL', exitCode: null, cached: false, durationMs: Math.ceil(performance.now() - start) });
        throw error;
      }
    }
    report.jest = readJestSummary(directory, inventory);
    const denials = readFileSync(resolve(directory, 'network-denials.txt'), 'utf8');
    report.networkDenials = denials.split('\n').filter(Boolean).length;
    if (report.networkDenials !== 0) throw new Error('M5_REGRESSION_NETWORK_DENIAL');
    if (releaseFingerprint(root).sha256 !== fingerprint.sha256) throw new Error('M5_REGRESSION_CANDIDATE_CHANGED');
    report.regressionVerified = true;
    report.outcome = 'PASS';
    assertRegressionEvidence(report, report.candidate);
    report.steps.push({ name: 'ten-uncached-code-regression-targets', outcome: 'PASS' });
  } finally {
    fixture.closeAllConnections(); await new Promise(yes => fixture.close(yes));
  }
}
main().catch(error => {
  report.regressionVerified = false; report.outcome = 'BLOCKED';
  report.steps.push({ name: 'regression-execution', outcome: 'BLOCKED', code: codeOf(error) });
}).finally(() => {
  report.outcome ??= report.steps.some(row => row.outcome === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  report.completedAt = new Date().toISOString();
  assertArtifactPath(root); mkdirSync(resolve(root, 'artifacts/m5'), { recursive: true });
  const reportFile = `artifacts/m5/${report.runId}.json`;
  writeFileSync(resolve(root, reportFile), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ version: report.version, action: report.action, outcome: report.outcome,
    regressionVerified: report.regressionVerified, browserVerified: false, milestoneComplete: false, reportFile,
    completedTargets: report.tasks.length, steps: report.steps }, null, 2));
  process.exitCode = report.outcome === 'PASS' ? 0 : 1;
});
