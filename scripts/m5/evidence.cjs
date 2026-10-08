const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { resolve, relative } = require('node:path');

// Bind evidence to the candidate, including the actual business implementation.
function sourceChecksums(root) {
  const files = ['package.json', 'pnpm-lock.yaml', 'prisma/schema.prisma', 'apps/api/project.json',
    'apps/api/tsconfig.json', 'apps/api/tsconfig.app.json', 'apps/api/tsconfig.spec.json', 'apps/api/jest.config.ts',
    'tsconfig.base.json', 'eslint.config.mjs', '.github/workflows/m5-foundation.yml'];
  function walk(directory) {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(?:ts|cjs|json|sql|ya?ml|toml)$/.test(entry.name)) files.push(path);
    }
  }
  for (const dir of ['scripts/m5', 'docker/m5', 'apps/api/src', 'prisma/migrations']) walk(dir);
  return Object.fromEntries(files.sort().map(file => [relative(root, resolve(root, file)).replaceAll('\\', '/'),
    createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
}
function assertFoundationEvidence(report, checksums, migrations) {
  if (report?.version !== 'm5.1-v1' || report.action !== 'verify' || report.outcome !== 'PASS'
    || report.foundationVerified !== true || report.productionActivated !== false || report.providerOperations !== false
    || report.scope !== 'LOCAL_SYNTHETIC_FOUNDATION_ONLY' || !/^[a-f0-9]{24}$/.test(report.runId ?? '')
    || JSON.stringify(report.sourceChecksums) !== JSON.stringify(checksums)
    || JSON.stringify(report.migrations) !== JSON.stringify(migrations)) throw new Error('M5_FOUNDATION_EVIDENCE_REQUIRED');
  for (const name of ['native-postgresql-fresh-chain', 'native-postgresql-upgrade-chain', 'local-redis-mongo-storage-mail-connectivity']) {
    if (!report.steps?.some(step => step.name === name && step.outcome === 'PASS')) throw new Error('M5_FOUNDATION_EVIDENCE_REQUIRED');
  }
  return report.runId;
}
function findFoundationEvidence(root, checksums, migrations) {
  let files;
  try { files = readdirSync(resolve(root, 'artifacts/m5')); } catch { throw new Error('M5_FOUNDATION_EVIDENCE_REQUIRED'); }
  for (const file of files.filter(name => /^[a-f0-9]{24}\.json$/.test(name)).sort().reverse()) {
    try { return assertFoundationEvidence(JSON.parse(readFileSync(resolve(root, 'artifacts/m5', file), 'utf8')), checksums, migrations); }
    catch { /* A partial, blocked, stale or unrelated report is not acceptance. */ }
  }
  throw new Error('M5_FOUNDATION_EVIDENCE_REQUIRED');
}
function assertContentionEvidence(result, runId, foundationId) {
  const names = require('./scenario-contract.json');
  const races = new Set(['outbox-lease-fencing-and-exhaustion', 'operation-intent-and-dispatch-replay', 'last-product-unit',
    'grouped-pool-replay-and-release', 'last-variant-unit', 'unlimited-and-digital-pools', 'duplicate-capture-and-lifecycle',
    'consumer-effect-rollback', 'payout-overspend-and-reject', 'payout-settle-versus-reject', 'refund-intent-idempotency',
    'refund-settlement-replay', 'payout-versus-refund', 'post-payout-refund-and-debt-recovery', 'late-capture-reacquisition']);
  if (result?.version !== 'm5.2-cases-v1' || result.outcome !== 'PASS' || result.runId !== runId || result.foundationId !== foundationId
    || result.database !== 'ezihubb_m5_scenarios' || result.providerEvidence !== 'SYNTHETIC_TEST_ONLY' || result.fullStack !== false
    || !Array.isArray(result.cases) || JSON.stringify(result.cases.map(row => row.name)) !== JSON.stringify(names)
    || result.cases.some(row => row.outcome !== 'PASS' || row.assertions !== 'EXACT_DB_STATE' || !Array.isArray(row.backendPids)
      || row.backendPids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)
      || (races.has(row.name) && new Set(row.backendPids).size < 2))) throw new Error('M5_CONTENTION_INCOMPLETE');
  return result.cases.map(({ name, outcome, assertions, backendPids }) => ({ name, outcome, assertions, backendPids }));
}
function assertCompletedContentionReport(report, checksums, migrations, foundationId) {
  if (report?.version !== 'm5.2-v1' || report.action !== 'contention' || report.outcome !== 'PASS'
    || report.contentionVerified !== true || report.productionActivated !== false || report.providerOperations !== false
    || report.scope !== 'LOCAL_SYNTHETIC_CONTENTION_ONLY' || report.foundationRunId !== foundationId
    || !/^[a-f0-9]{24}$/.test(report.runId ?? '')
    || JSON.stringify(report.sourceChecksums) !== JSON.stringify(checksums)
    || JSON.stringify(report.migrations) !== JSON.stringify(migrations)
    || !report.steps?.some(step => step.name === 'native-prisma-multi-session-business-invariants' && step.outcome === 'PASS')) {
    throw new Error('M5_CONTENTION_EVIDENCE_REQUIRED');
  }
  assertContentionEvidence({ version: 'm5.2-cases-v1', outcome: 'PASS', runId: report.runId, foundationId,
    database: 'ezihubb_m5_scenarios', providerEvidence: 'SYNTHETIC_TEST_ONLY', fullStack: false, cases: report.cases }, report.runId, foundationId);
  return report.runId;
}
function findContentionEvidence(root, checksums, migrations, foundationId) {
  let files;
  try { files = readdirSync(resolve(root, 'artifacts/m5')); } catch { throw new Error('M5_CONTENTION_EVIDENCE_REQUIRED'); }
  for (const file of files.filter(name => /^[a-f0-9]{24}\.json$/.test(name)).sort().reverse()) {
    try { return assertCompletedContentionReport(JSON.parse(readFileSync(resolve(root, 'artifacts/m5', file), 'utf8')), checksums, migrations, foundationId); }
    catch { /* A partial or stale contention run cannot authorize sandbox probes. */ }
  }
  throw new Error('M5_CONTENTION_EVIDENCE_REQUIRED');
}
module.exports = { sourceChecksums, assertFoundationEvidence, findFoundationEvidence, assertContentionEvidence,
  assertCompletedContentionReport, findContentionEvidence };
