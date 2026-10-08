const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, lstatSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { assertRuntime } = require('./guard.cjs');
const { assertFoundationEvidence, assertCompletedContentionReport } = require('./evidence.cjs');
const { assertRecoveryEvidence } = require('./recovery-support.cjs');
const { assertRegressionEvidence } = require('./regression.cjs');

const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const MAX_REPORTS = 2000;
const ID = /^[a-f0-9]{24}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Broader than the native DB harness fingerprint: frontend/shared/ops changes
// also change the release candidate. Never read private manifests or config.
function releaseFingerprint(root) {
  const files = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'nx.json',
    'tsconfig.base.json', 'eslint.config.mjs', 'prisma.config.ts', 'docker-compose.yml', '.dockerignore', 'jest.preset.js']);
  for (const optional of ['jest.config.ts', 'tsconfig.json', 'babel.config.js', 'babel.config.json', '.swcrc']) {
    if (existsSync(resolve(root, optional))) files.add(optional);
  }
  const ignored = new Set(['node_modules', 'dist', '.next', 'out-tsc', 'coverage', '.git', 'tmp', 'artifacts', '.codex', '.claude']);
  const allowed = /\.(?:[cm]?[jt]sx?|json|ya?ml|sql|prisma|toml|conf|css|scss|sh|html|svg|png|jpe?g|webp|avif|gif|ico|mp4|webm|woff2?|md)$/i;
  function walk(directory) {
    const absolute = resolve(root, directory);
    if (lstatSync(absolute).isSymbolicLink()) throw new Error('M5_RELEASE_SOURCE_LINK');
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.name.startsWith('.env') || /\.local(?:\.|$)/.test(entry.name)
        || entry.name === 'next-env.d.ts' || entry.name.endsWith('.tsbuildinfo')) continue;
      const file = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('M5_RELEASE_SOURCE_LINK');
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && (allowed.test(entry.name) || /^Dockerfile(?:\.|$)/.test(entry.name))) files.add(file);
    }
  }
  for (const directory of ['apps', 'libs', 'scripts', 'docker', 'prisma', '.github/workflows', 'docs/production-hardening']) walk(directory);
  const checksums = Object.fromEntries([...files].sort().map(file => {
    const path = resolve(root, file), info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 * 1024) throw new Error('M5_RELEASE_SOURCE_FILE');
    return [file, hash(readFileSync(path))];
  }));
  return { sha256: hash(JSON.stringify(checksums)), fileCount: files.size, checksums };
}

function assertArtifactPath(root) {
  for (const directory of ['artifacts', 'artifacts/m5']) {
    const path = resolve(root, directory);
    if (existsSync(path)) {
      const info = lstatSync(path);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('M5_RELEASE_REPORT_DIRECTORY');
    }
  }
}
function readReports(root) {
  assertArtifactPath(root);
  const directory = resolve(root, 'artifacts/m5');
  if (!existsSync(directory)) return { entries: [], rejectedCount: 0 };
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('M5_RELEASE_REPORT_DIRECTORY');
  const names = readdirSync(directory).filter(name => /^[a-f0-9]{24}\.json$/.test(name)).sort();
  if (names.length > MAX_REPORTS) throw new Error('M5_RELEASE_REPORT_LIMIT');
  const entries = [];
  let rejectedCount = 0;
  for (const name of names) {
    try {
      const path = resolve(directory, name), info = lstatSync(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > MAX_REPORT_BYTES) throw new Error('invalid');
      const bytes = readFileSync(path), report = JSON.parse(bytes.toString('utf8'));
      if (!report || typeof report !== 'object' || Array.isArray(report) || report.runId !== name.slice(0, -5)) throw new Error('invalid');
      entries.push({ report, sha256: hash(bytes) });
    } catch { rejectedCount++; } // Never echo filenames, raw JSON or driver errors.
  }
  return { entries, rejectedCount };
}

function time(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : NaN;
}
function validEnvelope(report, now) {
  const start = time(report.startedAt), end = time(report.completedAt);
  return ID.test(report.runId ?? '') && Number.isFinite(start) && Number.isFinite(end)
    && start <= end && end <= now && Array.isArray(report.steps) && report.steps.length > 0
    && report.steps.every(step => step && typeof step.name === 'string' && step.outcome === 'PASS')
    && new Set(report.steps.map(step => step.name)).size === report.steps.length;
}
function passedStep(report, name) { return report.steps.some(step => step.name === name && step.outcome === 'PASS'); }
function gate(id, status, code, entry) {
  const result = { id, status, code };
  if (entry) result.evidence = { runId: entry.report.runId, sha256: entry.sha256 };
  return result;
}
function latest(entries, version, action, checksums, migrations, now, candidateSha256) {
  const relevant = entries.filter(entry => entry.report.version === version && entry.report.action === action);
  const current = relevant.filter(entry => same(entry.report.sourceChecksums, checksums) && same(entry.report.migrations, migrations)
    && (!candidateSha256 || entry.report.candidate?.sha256 === candidateSha256));
  if (!current.length) return { status: relevant.length ? 'STALE' : 'MISSING', code: relevant.length ? 'CANDIDATE_MISMATCH' : 'NO_EXECUTION_REPORT' };
  // Unorderable/current reports cannot be silently discarded to resurrect PASS.
  if (current.some(entry => !Number.isFinite(time(entry.report.completedAt)) || !Number.isFinite(time(entry.report.startedAt))
    || time(entry.report.startedAt) > time(entry.report.completedAt) || time(entry.report.completedAt) > now)) {
    return { status: 'INVALID', code: 'REPORT_TIME_INVALID' };
  }
  current.sort((a, b) => time(b.report.completedAt) - time(a.report.completedAt));
  if (current.length > 1 && current[0].report.completedAt === current[1].report.completedAt) return { status: 'INVALID', code: 'REPORT_ORDER_AMBIGUOUS' };
  const entry = current[0];
  if (entry.report.outcome !== 'PASS') return { status: 'BLOCKED', code: 'LATEST_EXECUTION_NOT_PASS', entry };
  if (!validEnvelope(entry.report, now)) return { status: 'INVALID', code: 'REPORT_ENVELOPE_INVALID', entry };
  return { entry };
}
function evaluate({ entries, rejectedCount = 0, checksums, migrations, candidate, now = Date.now(), nodeVersion = process.versions.node }) {
  const gates = [];
  try { assertRuntime(nodeVersion); gates.push(gate('runtime', 'PASS', 'SUPPORTED_NODE')); }
  catch { gates.push(gate('runtime', 'BLOCKED', 'NODE_BASELINE')); }
  gates.push(gate('evidence-files', rejectedCount ? 'INVALID' : 'PASS', rejectedCount ? 'REJECTED_REPORT_FILES' : 'BOUNDED_REGULAR_REPORT_FILES'));
  function select(id, version, action, validate) {
    const selected = latest(entries, version, action, checksums, migrations, now);
    if (selected.status) { gates.push(gate(id, selected.status, selected.code, selected.entry)); return; }
    try {
      validate(selected.entry.report);
      gates.push(gate(id, 'PASS', 'VALID_CURRENT_NATIVE_REPORT', selected.entry));
      return selected.entry.report;
    } catch { gates.push(gate(id, 'INVALID', 'INCOMPLETE_OR_UNLINKED_EVIDENCE', selected.entry)); }
  }
  const foundation = select('native-foundation', 'm5.1-v1', 'verify', report => assertFoundationEvidence(report, checksums, migrations));
  const contention = select('native-contention', 'm5.2-v1', 'contention', report => {
    if (!foundation || time(report.startedAt) < time(foundation.completedAt)) throw new Error('chain');
    assertCompletedContentionReport(report, checksums, migrations, foundation.runId);
    if (report.cases.some(row => !row.backendPids.length)) throw new Error('native-session');
  });
  select('native-local-recovery', 'm5.4-v1', 'drill', report => {
    if (!foundation || !contention || report.foundationRunId !== foundation.runId || report.contentionRunId !== contention.runId
      || time(report.startedAt) < time(contention.completedAt) || report.recoveryVerified !== true
      || report.productionActivated !== false || report.providerOperations !== false || report.fullStackVerified !== false
      || report.milestoneComplete !== false || report.scope !== 'LOCAL_SYNTHETIC_RECOVERY_ONLY'
      || !passedStep(report, 'native-local-failure-and-restore') || !passedStep(report, 'owned-stack-running-after-child')) throw new Error('recovery');
    assertRecoveryEvidence({ version: 'm5.4-cases-v1', outcome: report.outcome, runId: report.runId,
      foundationId: report.foundationRunId, contentionId: report.contentionRunId, scope: report.scope,
      fullStack: report.fullStackVerified, providerOperations: report.providerOperations, cases: report.cases, restore: report.restore },
    report.runId, foundation.runId, contention.runId);
    const snapshot = time(report.restore.metrics.snapshotAt), acknowledgement = time(report.restore.metrics.lastAcknowledgedAt);
    if (!Number.isFinite(snapshot) || !Number.isFinite(acknowledgement) || snapshot < time(report.startedAt)
      || acknowledgement > time(report.completedAt)) throw new Error('measurement-time');
  });
  // Binding GETs, synthetic HTTPS tests and local recovery are contextual only.
  // No writer exists yet for the following *actual* acceptance evidence. Reject
  // arbitrary appended fullStackVerified booleans/unknown report versions.
  const binding = latest(entries, 'm5.3-preflight-v1', 'probe', checksums, migrations, now);
  let bindingStatus = binding.status ?? 'INVALID';
  if (binding.entry && !binding.status) {
    const report = binding.entry.report;
    if (foundation && contention && report.foundationRunId === foundation.runId && report.contentionRunId === contention.runId
      && time(report.startedAt) >= time(contention.completedAt) && report.scope === 'SANDBOX_BINDING_READS_ONLY_NOT_FULLSTACK'
      && report.productionActivated === false && report.financialOperations === false && report.providerNetworkAttempted === true
      && report.bindingReadsVerified === true && report.fullStackVerified === false && report.sandboxVerified === false
      && report.webhookDeliveryVerified === false && report.signingSecretVerified === false && report.paypalMerchantVerified === false
      && passedStep(report, 'stripe-test-and-paypal-sandbox-webhook-bindings')) bindingStatus = 'PASS';
  }
  for (const [id, code] of [
    ['https-appmodule-auth-mail-browser', 'FULLSTACK_DRIVER_NOT_IMPLEMENTED'],
    ['provider-sandbox-financial-reconciliation', 'PROVIDER_CALLBACK_SETTLEMENT_DRIVER_NOT_IMPLEMENTED'],
    ['staging-api-worker-proxy-alert-recovery', 'STAGING_FAILURE_DRIVER_NOT_IMPLEMENTED'],
    ['whole-system-restore-rpo-rto', 'SERVICE_RESTORE_AND_APPROVED_OBJECTIVES_NOT_VERIFIED'],
    ['release-owner-authorization', 'SEPARATE_CANDIDATE_BOUND_APPROVAL_REQUIRED'],
  ]) gates.push(gate(id, 'NOT_VERIFIED', code));
  const regression = latest(entries, 'm5.5-regression-v1', 'run', checksums, migrations, now, candidate.sha256);
  if (regression.status) gates.push(gate('candidate-wide-regression', regression.status, regression.code, regression.entry));
  else {
    try {
      assertRegressionEvidence(regression.entry.report, candidate);
      if (!passedStep(regression.entry.report, 'resolved-nx-targets-and-original-budgets')
        || !passedStep(regression.entry.report, 'ten-uncached-code-regression-targets')) throw new Error('incomplete');
      gates.push(gate('candidate-wide-regression', 'PASS', 'VALID_CODE_REGRESSION_ONLY_BROWSER_GATE_SEPARATE', regression.entry));
    } catch { gates.push(gate('candidate-wide-regression', 'INVALID', 'INCOMPLETE_CODE_REGRESSION_EVIDENCE', regression.entry)); }
  }
  const blockers = gates.filter(row => row.status !== 'PASS').map(row => row.id);
  return { version: 'm5.5-v1', scope: 'READ_ONLY_ACCEPTANCE_DOSSIER_NOT_RELEASE_AUTHORITY',
    verdict: blockers.length ? 'NO_GO' : 'GO', candidate: { sha256: candidate.sha256, fileCount: candidate.fileCount },
    gates, blockers, context: { sandboxBindingReads: bindingStatus, bindingIsFullStackEvidence: false,
      localReportsAreUnsigned: true, externalEvidenceDriverSupported: false, rejectedReportCount: rejectedCount,
      regressionScope: 'CODE_REGRESSION_ONLY_NOT_NATIVE_BROWSER_PROVIDER' },
    productionActivated: false, providerOperations: false, deploymentAuthorized: false, milestoneComplete: false };
}
function renderMarkdown(report) {
  return `# M5.5 acceptance dossier\n\nVerdict: **${report.verdict}**. Not deployment or payment activation authority.\n\n`
    + `Candidate SHA-256: \`${report.candidate.sha256}\` (${report.candidate.fileCount} public source files).\n\n`
    + '| Gate | Status | Reason | Evidence run |\n|---|---|---|---|\n'
    + report.gates.map(row => `| ${row.id} | ${row.status} | ${row.code} | ${row.evidence?.runId ?? '—'} |`).join('\n')
    + '\n\nSandbox binding reads: ' + report.context.sandboxBindingReads
    + '. Binding reads are not callback/settlement proof. Local reports are unsigned diagnostics; retain CI provenance for review.\n\n'
    + 'Unimplemented full-stack/staging evidence drivers and missing owner authorization remain explicit blockers. '
    + 'No supplied boolean, unit-test count, doctor PASS or local restore can close them. '
    + 'No environment, credentials, database, Docker daemon or external provider is accessed by this report.\n';
}
module.exports = { MAX_REPORT_BYTES, assertArtifactPath, readReports, releaseFingerprint, evaluate, renderMarkdown };
