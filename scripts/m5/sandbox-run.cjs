const { randomBytes } = require('node:crypto');
const { existsSync, readFileSync, lstatSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { assertRuntime, migrationManifest } = require('./guard.cjs');
const { sourceChecksums, findFoundationEvidence, findContentionEvidence } = require('./evidence.cjs');
const { assertSandboxManifest, assertSandboxRuntimeEnvironment, probeBindings } = require('./sandbox.cjs');
const root = resolve(__dirname, '../..');
const report = { version: 'm5.3-preflight-v1', runId: randomBytes(12).toString('hex'), startedAt: new Date().toISOString(),
  scope: 'SANDBOX_BINDING_READS_ONLY_NOT_FULLSTACK', steps: [], productionActivated: false,
  providerNetworkAttempted: false,
  financialOperations: false, webhookDeliveryVerified: false, fullStackVerified: false, sandboxVerified: false,
  sourceChecksums: sourceChecksums(root) };
const codeOf = error => /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_SANDBOX_PREFLIGHT_FAILED';
function step(name, work) {
  try { const value = work(); report.steps.push({ name, outcome: 'PASS' }); return value; }
  catch (error) { report.steps.push({ name, outcome: 'BLOCKED', code: codeOf(error) }); return undefined; }
}
async function main() {
  const action = process.argv[2]; report.action = action;
  if (process.argv.length !== 3 || !['doctor', 'probe'].includes(action)) throw new Error('M5_ACTION');
  step('runtime-baseline', () => assertRuntime());
  step('ambient-tls-and-startup-options', () => assertSandboxRuntimeEnvironment());
  const manifest = migrationManifest(root); report.migrations = manifest;
  const foundationId = step('accepted-native-foundation', () => findFoundationEvidence(root, report.sourceChecksums, manifest));
  if (foundationId) {
    report.foundationRunId = foundationId;
    report.contentionRunId = step('accepted-native-contention', () => findContentionEvidence(root, report.sourceChecksums, manifest, foundationId));
  } else report.steps.push({ name: 'accepted-native-contention', outcome: 'BLOCKED', code: 'M5_FOUNDATION_EVIDENCE_REQUIRED' });
  const env = step('separate-private-sandbox-manifest', () => {
    const path = resolve(root, '.env.m5-sandbox.local');
    if (!existsSync(path)) throw new Error('M5_SANDBOX_MANIFEST_MISSING');
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384) throw new Error('M5_SANDBOX_MANIFEST');
    return assertSandboxManifest(readFileSync(path, 'utf8'));
  });
  if (report.steps.some(row => row.outcome === 'BLOCKED')) { report.outcome = 'BLOCKED'; return; }
  if (action === 'probe') {
    report.providerNetworkAttempted = true;
    const result = await probeBindings(env);
    report.steps.push({ name: 'stripe-test-and-paypal-sandbox-webhook-bindings', outcome: 'PASS' });
    report.bindingReadsVerified = result.stripeBinding === 'PASS' && result.paypalBinding === 'PASS';
    report.signingSecretVerified = result.signingSecretVerified; report.paypalMerchantVerified = result.paypalMerchantVerified;
  }
  report.outcome = 'PASS'; // Preflight only; full M5.3 flags above intentionally stay false.
}
main().catch(error => { report.outcome = 'BLOCKED'; report.steps.push({ name: 'preflight', outcome: 'BLOCKED', code: codeOf(error) }); })
  .finally(() => {
    report.completedAt = new Date().toISOString(); mkdirSync(resolve(root, 'artifacts/m5'), { recursive: true });
    const reportFile = `artifacts/m5/${report.runId}.json`;
    writeFileSync(resolve(root, reportFile), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ version: report.version, action: report.action, outcome: report.outcome, reportFile,
      fullStackVerified: false, sandboxVerified: false, steps: report.steps }, null, 2));
    process.exitCode = report.outcome === 'PASS' ? 0 : 1;
  });
