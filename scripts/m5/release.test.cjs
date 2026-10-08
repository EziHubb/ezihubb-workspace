const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { evaluate, readReports, releaseFingerprint, renderMarkdown, MAX_REPORT_BYTES } = require('./release.cjs');
const { restoreDatabase, measureRestore } = require('./recovery-support.cjs');
const foundationId = 'a'.repeat(24), contentionId = 'b'.repeat(24), recoveryId = 'c'.repeat(24);
const checksums = { 'candidate.ts': 'd'.repeat(64) }, migrations = [{ name: 'candidate', checksum: 'e'.repeat(64) }];
const candidate = { sha256: 'f'.repeat(64), fileCount: 10 };
const now = Date.parse('2026-10-08T12:00:00.000Z');
function envelope(version, action, runId, hour) {
  return { version, action, runId, outcome: 'PASS', productionActivated: false, providerOperations: false,
    sourceChecksums: checksums, migrations, startedAt: `2026-10-08T0${hour}:00:00.000Z`,
    completedAt: `2026-10-08T0${hour}:30:00.000Z`, steps: [] };
}
function foundation() {
  return { ...envelope('m5.1-v1', 'verify', foundationId, 1), foundationVerified: true, scope: 'LOCAL_SYNTHETIC_FOUNDATION_ONLY',
    steps: ['native-postgresql-fresh-chain', 'native-postgresql-upgrade-chain', 'local-redis-mongo-storage-mail-connectivity']
      .map(name => ({ name, outcome: 'PASS' })) };
}
function contention() {
  return { ...envelope('m5.2-v1', 'contention', contentionId, 2), contentionVerified: true,
    scope: 'LOCAL_SYNTHETIC_CONTENTION_ONLY', foundationRunId: foundationId,
    steps: [{ name: 'native-prisma-multi-session-business-invariants', outcome: 'PASS' }],
    cases: require('./scenario-contract.json').map(name => ({ name, outcome: 'PASS', assertions: 'EXACT_DB_STATE', backendPids: [101, 102] })) };
}
function recovery() {
  return { ...envelope('m5.4-v1', 'drill', recoveryId, 3), recoveryVerified: true, fullStackVerified: false, milestoneComplete: false,
    scope: 'LOCAL_SYNTHETIC_RECOVERY_ONLY', foundationRunId: foundationId, contentionRunId: contentionId,
    steps: ['native-local-failure-and-restore', 'owned-stack-running-after-child'].map(name => ({ name, outcome: 'PASS' })),
    cases: require('./recovery-contract.json').map(name => ({ name, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY',
      durationMs: 1, killedPid: 101, backendPid: 201, exitObserved: true })),
    restore: { database: restoreDatabase(recoveryId), backupSha256: 'f'.repeat(64), backupBytes: 1000, snapshotHash: 'e'.repeat(64),
      scope: 'PUBLIC_POSTGRES_SCHEMA_ONLY_NOT_REDIS_MONGO_STORAGE', retainedPrivateBackup: true,
      snapshotMatched: true, replayDeduplicated: true, sourcePreserved: true,
      metrics: measureRestore({ snapshotAt: '2026-10-08T03:00:00.000Z', lastAcknowledgedAt: '2026-10-08T03:00:01.000Z', missingAcknowledgements: 1, rtoMs: 1000 }) } };
}
function binding() {
  return { ...envelope('m5.3-preflight-v1', 'probe', 'd'.repeat(24), 4), foundationRunId: foundationId, contentionRunId: contentionId,
    scope: 'SANDBOX_BINDING_READS_ONLY_NOT_FULLSTACK', financialOperations: false, providerNetworkAttempted: true,
    bindingReadsVerified: true, fullStackVerified: false, sandboxVerified: false, webhookDeliveryVerified: false,
    signingSecretVerified: false, paypalMerchantVerified: false,
    steps: [{ name: 'stripe-test-and-paypal-sandbox-webhook-bindings', outcome: 'PASS' }] };
}
function codeRegression() {
  return { ...envelope('m5.5-regression-v1', 'run', 'e'.repeat(24), 5), candidate,
    scope: require('./regression.cjs').SCOPE, regressionVerified: true, browserVerified: false, nativeVerified: false,
    milestoneComplete: false, runtime: { node: '24.15.0', platform: 'linux' },
    networkPolicy: 'OWNED_LOOPBACK_AND_GOOGLE_FONT_DOWNLOADS_ONLY', networkDenials: 0, fixture: { mode: 'STATIC_BUILD_503_NOT_REAL_API' },
    steps: ['resolved-nx-targets-and-original-budgets', 'ten-uncached-code-regression-targets'].map(name => ({ name, outcome: 'PASS' })),
    tasks: require('./regression.cjs').TASKS.map(task => ({ task, outcome: 'PASS', exitCode: 0, cached: false, durationMs: 1, logSha256: 'f'.repeat(64) })),
    jest: { tests: 889, suites: 90, testFiles: 90, inventorySha256: 'd'.repeat(64), skipped: 0, todo: 0, failed: 0,
      coverageCollected: true, reportSha256: 'a'.repeat(64) } };
}
function entry(report) { return { report, sha256: createHash('sha256').update(JSON.stringify(report)).digest('hex') }; }
function run(reports = [foundation(), contention(), recovery()], overrides = {}) {
  return evaluate({ entries: reports.map(entry), checksums, migrations, candidate, now, nodeVersion: '24.15.0', ...overrides });
}
function status(report, id) { return report.gates.find(row => row.id === id)?.status; }

test('no evidence is NO_GO, with fixed missing native and external/approval gates', () => {
  const result = run([]);
  assert.equal(result.verdict, 'NO_GO'); assert.equal(result.deploymentAuthorized, false); assert.equal(result.milestoneComplete, false);
  for (const id of ['native-foundation', 'native-contention', 'native-local-recovery']) assert.equal(status(result, id), 'MISSING');
  assert.equal(result.gates.length, 11); assert.equal(result.blockers.length, 9);
});
test('complete native chain plus binding reads never claims full-stack, service restore or permission', () => {
  const result = run([foundation(), contention(), recovery(), binding()]);
  for (const id of ['native-foundation', 'native-contention', 'native-local-recovery']) assert.equal(status(result, id), 'PASS');
  assert.equal(result.context.sandboxBindingReads, 'PASS'); assert.equal(result.context.bindingIsFullStackEvidence, false);
  assert.equal(result.blockers.length, 6); assert.equal(result.verdict, 'NO_GO');
});
test('complete current code regression can pass its gate but never closes real browser/provider/owner gates', () => {
  const result = run([foundation(), contention(), recovery(), codeRegression()]);
  assert.equal(status(result, 'candidate-wide-regression'), 'PASS');
  assert.equal(result.blockers.length, 5); assert.equal(result.verdict, 'NO_GO');
  assert.equal(status(result, 'https-appmodule-auth-mail-browser'), 'NOT_VERIFIED');
  assert.equal(result.context.regressionScope, 'CODE_REGRESSION_ONLY_NOT_NATIVE_BROWSER_PROVIDER');
});
test('frontend-only source change invalidates code regression, without pretending native DB evidence is stale', () => {
  const result = run([foundation(), contention(), recovery(), codeRegression()], { candidate: { ...candidate, sha256: '0'.repeat(64) } });
  assert.equal(status(result, 'native-foundation'), 'PASS'); assert.equal(status(result, 'candidate-wide-regression'), 'STALE');
});
test('failed rerun, incomplete targets, cached results and preflight cannot pass regression', () => {
  const pass = codeRegression();
  const fail = { ...pass, runId: 'f'.repeat(24), outcome: 'BLOCKED', completedAt: '2026-10-08T06:00:00.000Z' };
  assert.equal(status(run([pass, fail]), 'candidate-wide-regression'), 'BLOCKED');
  for (const change of [{ tasks: pass.tasks.slice(1) }, { tasks: pass.tasks.map(row => ({ ...row, cached: true })) },
    { browserVerified: true }, { fixture: { mode: 'REAL_API' } }, { jest: { ...pass.jest, skipped: 1 } }]) {
    assert.equal(status(run([{ ...pass, ...change }]), 'candidate-wide-regression'), 'INVALID');
  }
  assert.equal(status(run([{ ...pass, action: 'doctor' }]), 'candidate-wide-regression'), 'MISSING');
});
test('latest failed execution blocks an older valid PASS; doctor does not replace execution', () => {
  const failed = { ...foundation(), runId: 'e'.repeat(24), outcome: 'BLOCKED', completedAt: '2026-10-08T05:00:00.000Z' };
  assert.equal(status(run([foundation(), failed]), 'native-foundation'), 'BLOCKED');
  const doctor = { ...failed, action: 'doctor' };
  assert.equal(status(run([foundation(), doctor]), 'native-foundation'), 'PASS');
});
test('new successful rerun supersedes failure only for that candidate, independent of filename order', () => {
  const failed = { ...foundation(), runId: 'f'.repeat(24), outcome: 'FAIL' };
  const pass = { ...foundation(), runId: '0'.repeat(24), startedAt: '2026-10-08T05:00:00.000Z', completedAt: '2026-10-08T05:01:00.000Z' };
  assert.equal(status(run([pass, failed]), 'native-foundation'), 'PASS');
});
test('old source and migration hashes cannot close current native gates', () => {
  assert.equal(status(run([{ ...foundation(), sourceChecksums: {} }]), 'native-foundation'), 'STALE');
  assert.equal(status(run([{ ...foundation(), migrations: [] }]), 'native-foundation'), 'STALE');
});
test('a newer foundation requires contention and recovery linked to the exact new chain', () => {
  const replacement = { ...foundation(), runId: 'e'.repeat(24), completedAt: '2026-10-08T01:45:00.000Z' };
  const result = run([foundation(), replacement, contention(), recovery()]);
  assert.equal(status(result, 'native-foundation'), 'PASS'); assert.equal(status(result, 'native-contention'), 'INVALID');
  assert.equal(status(result, 'native-local-recovery'), 'INVALID');
});
test('child reports must start after parent completes', () => {
  assert.equal(status(run([foundation(), { ...contention(), startedAt: foundation().startedAt }]), 'native-contention'), 'INVALID');
  assert.equal(status(run([foundation(), contention(), { ...recovery(), startedAt: contention().startedAt }]), 'native-local-recovery'), 'INVALID');
});
test('report timestamps cannot be missing, future, reversed or ambiguously tied', () => {
  for (const change of [{ completedAt: undefined }, { startedAt: 'unknown' }, { completedAt: '2026-10-09T00:00:00.000Z' },
    { startedAt: '2026-10-08T08:00:00.000Z' }]) {
    assert.equal(status(run([foundation(), { ...foundation(), runId: 'e'.repeat(24), ...change }]), 'native-foundation'), 'INVALID');
  }
  assert.equal(status(run([foundation(), { ...foundation(), runId: 'e'.repeat(24) }]), 'native-foundation'), 'INVALID');
});
test('contradictory, missing or duplicated step outcomes reject native acceptance', () => {
  for (const steps of [[], [...foundation().steps, { name: 'extra', outcome: 'BLOCKED' }], [...foundation().steps, foundation().steps[0]]]) {
    assert.equal(status(run([{ ...foundation(), steps }]), 'native-foundation'), 'INVALID');
  }
});
test('all 23 native contention cases and genuine independent session claims are required', () => {
  for (const cases of [contention().cases.slice(1), contention().cases.map(row => ({ ...row, backendPids: [101, 101] })),
    contention().cases.map(row => ({ ...row, backendPids: [] }))]) {
    assert.equal(status(run([foundation(), { ...contention(), cases }]), 'native-contention'), 'INVALID');
  }
});
test('recovery wrapper cannot falsify native process, scope, restore or service-RTO claims', () => {
  const source = recovery();
  for (const change of [{ fullStackVerified: true }, { milestoneComplete: true }, { cases: source.cases.slice(1) },
    { cases: source.cases.map(row => ({ ...row, exitObserved: false })) },
    { restore: { ...source.restore, metrics: { ...source.restore.metrics, serviceRtoMs: 0 } } },
    { restore: { ...source.restore, sourcePreserved: false } }, { contentionRunId: foundationId }]) {
    assert.equal(status(run([foundation(), contention(), { ...source, ...change }]), 'native-local-recovery'), 'INVALID');
  }
});
test('doctor PASS, unit-test reports and unknown acceptance/approval versions cannot authorize release', () => {
  const fabricated = { ...binding(), version: 'm5.3-fullstack-v1', fullStackVerified: true, sandboxVerified: true, ownerApproved: true };
  const result = run([foundation(), contention(), { ...recovery(), action: 'doctor' }, fabricated]);
  assert.equal(status(result, 'native-local-recovery'), 'MISSING'); assert.equal(result.verdict, 'NO_GO');
  assert.equal(status(result, 'release-owner-authorization'), 'NOT_VERIFIED');
});
test('binding preflight that claims more than GETs is not accepted even as contextual evidence', () => {
  assert.equal(run([foundation(), contention(), binding()]).context.sandboxBindingReads, 'PASS');
  for (const change of [{ fullStackVerified: true }, { financialOperations: true }, { webhookDeliveryVerified: true },
    { signingSecretVerified: true }, { paypalMerchantVerified: true }, { foundationRunId: recoveryId }]) {
    assert.equal(run([foundation(), contention(), { ...binding(), ...change }]).context.sandboxBindingReads, 'INVALID');
  }
});
test('runtime downgrade and invalid report files fail closed independently of native PASS', () => {
  assert.equal(status(run(undefined, { nodeVersion: '24.14.0' }), 'runtime'), 'BLOCKED');
  assert.equal(status(run(undefined, { rejectedCount: 1 }), 'evidence-files'), 'INVALID');
});
test('dossier only projects fixed fields, never raw errors, credentials or arbitrary strings', () => {
  const marker = 'SECRET_USER_PAYLOAD_DO_NOT_ECHO';
  const result = run([{ ...foundation(), privateSecret: marker, steps: [...foundation().steps, { name: marker, outcome: 'BLOCKED', error: marker }] }]);
  assert(!JSON.stringify(result).includes(marker)); assert(!renderMarkdown(result).includes(marker));
});
test('bounded file reader refuses malformed, mismatched and oversized reports without echoing content', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'm5-release-reader-'));
  mkdirSync(resolve(directory, 'artifacts/m5'), { recursive: true });
  writeFileSync(resolve(directory, `artifacts/m5/${foundationId}.json`), JSON.stringify(foundation()));
  writeFileSync(resolve(directory, `artifacts/m5/${contentionId}.json`), 'SECRET_NOT_JSON');
  writeFileSync(resolve(directory, `artifacts/m5/${recoveryId}.json`), JSON.stringify(foundation()));
  writeFileSync(resolve(directory, `artifacts/m5/${'d'.repeat(24)}.json`), 'x'.repeat(MAX_REPORT_BYTES + 1));
  writeFileSync(resolve(directory, 'artifacts/m5/.env'), 'DO_NOT_READ');
  const result = readReports(directory);
  assert.equal(result.entries.length, 1); assert.equal(result.rejectedCount, 3); assert(!JSON.stringify(result).includes('SECRET_NOT_JSON'));
});
test('candidate fingerprint includes frontend/shared/ops but excludes private manifests and generated paths', () => {
  const root = resolve(__dirname, '../..'), fingerprint = releaseFingerprint(root);
  for (const name of ['apps/admin/src/components/finances/ActivitySummaryCard.tsx',
    'apps/client/src/app/[locale]/(storefront)/checkout/page.tsx', 'libs/shared/api-client/src/hooks/useCheckout.ts',
    'scripts/deploy.sh', 'scripts/nginx-ezihubb.conf', 'docker/Dockerfile', 'docker-compose.yml', 'pnpm-workspace.yaml',
    'prisma.config.ts', '.dockerignore', '.github/workflows/m5-foundation.yml', 'scripts/m5/release.cjs']) {
    assert.match(fingerprint.checksums[name], /^[a-f0-9]{64}$/);
  }
  assert(!Object.keys(fingerprint.checksums).some(name => name.includes('.env') || name.includes('.codex')
    || name.includes('.next/') || name.endsWith('next-env.d.ts') || name.includes('.deploy-config')));
  assert.equal(createHash('sha256').update(JSON.stringify(fingerprint.checksums)).digest('hex'), fingerprint.sha256);
});
test('a frontend edit changes the release identity; private/generated edits do not', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'm5-release-candidate-'));
  for (const directory of ['apps/client', 'libs', 'scripts', 'docker', 'prisma', '.github/workflows', 'docs/production-hardening']) {
    mkdirSync(resolve(root, directory), { recursive: true });
  }
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'nx.json', 'tsconfig.base.json',
    'eslint.config.mjs', 'prisma.config.ts', 'docker-compose.yml', '.dockerignore', 'jest.preset.js', 'apps/client/page.tsx']) {
    writeFileSync(resolve(root, name), 'public-fixture');
  }
  const original = releaseFingerprint(root).sha256;
  writeFileSync(resolve(root, 'apps/client/.env.local'), 'PRIVATE_DO_NOT_READ');
  writeFileSync(resolve(root, 'apps/client/next-env.d.ts'), 'generated');
  assert.equal(releaseFingerprint(root).sha256, original);
  writeFileSync(resolve(root, 'apps/client/page.tsx'), 'changed-public-fixture');
  assert.notEqual(releaseFingerprint(root).sha256, original);
});
test('artifact directory junction/symlink cannot redirect reads or create output outside the workspace', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'm5-release-boundary-'));
  const destination = mkdtempSync(resolve(tmpdir(), 'm5-release-link-target-'));
  symlinkSync(destination, resolve(root, 'artifacts'), 'junction');
  assert.throws(() => readReports(root), /M5_RELEASE_REPORT_DIRECTORY/);
  assert.equal(existsSync(resolve(destination, 'm5')), false);
});
test('collector is read-only apart from new ignored reports, and check is fail-closed', () => {
  const source = readFileSync(resolve(__dirname, 'release-run.cjs'), 'utf8');
  assert(source.includes("action === 'check' && report.verdict !== 'GO' ? 1 : 0"));
  assert(source.includes("flag: 'wx'"));
  for (const file of ['release.cjs', 'release-run.cjs']) {
    const code = readFileSync(resolve(__dirname, file), 'utf8');
    assert(!/child_process|fetch\(|parseEnv\(|readFileSync[^\n]*\.env|prisma\.(?:update|delete)|removeSync|unlinkSync/.test(code));
  }
});
