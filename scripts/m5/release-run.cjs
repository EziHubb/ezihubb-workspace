const { randomBytes } = require('node:crypto');
const { mkdirSync, lstatSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { sourceChecksums } = require('./evidence.cjs');
const { migrationManifest } = require('./guard.cjs');
const { assertArtifactPath, readReports, releaseFingerprint, evaluate, renderMarkdown } = require('./release.cjs');
const root = resolve(__dirname, '../..');

// "report" succeeds only at dossier generation; "check" fails on NO_GO. Neither
// executes tests, migrations, sandbox calls, deployment or activation.
function main() {
  const action = process.argv[2];
  if (process.argv.length !== 3 || !['report', 'check'].includes(action)) throw new Error('M5_RELEASE_ACTION');
  const runId = randomBytes(12).toString('hex'), startedAt = new Date().toISOString();
  const candidate = releaseFingerprint(root), checksums = sourceChecksums(root), migrations = migrationManifest(root);
  const inputs = readReports(root);
  const report = { ...evaluate({ ...inputs, checksums, migrations, candidate }), runId, action, startedAt };
  if (releaseFingerprint(root).sha256 !== candidate.sha256) throw new Error('M5_RELEASE_CANDIDATE_CHANGED');
  report.completedAt = new Date().toISOString();
  const directory = resolve(root, 'artifacts/m5');
  assertArtifactPath(root);
  mkdirSync(directory, { recursive: true });
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('M5_RELEASE_REPORT_DIRECTORY');
  writeFileSync(resolve(directory, `${runId}.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(resolve(directory, `${runId}.md`), renderMarkdown(report), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ version: report.version, action, verdict: report.verdict,
    dossierGenerated: true, milestoneComplete: false, deploymentAuthorized: false,
    reportFile: `artifacts/m5/${runId}.json`, markdownFile: `artifacts/m5/${runId}.md`, gates: report.gates }, null, 2));
  process.exitCode = action === 'check' && report.verdict !== 'GO' ? 1 : 0;
}
try { main(); } catch (error) {
  console.log(JSON.stringify({ dossierGenerated: false, verdict: 'NO_GO', code:
    /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_RELEASE_DOSSIER_FAILED', deploymentAuthorized: false }));
  process.exitCode = 1;
}
