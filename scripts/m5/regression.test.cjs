const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { TASKS, SCOPE, assertCleanCheckout, assertRegressionRuntime, regressionEnvironment, taskArguments,
  assertResolvedProject, apiTestInventory, jestSummary, assertRegressionEvidence } = require('./regression.cjs');
const { connectionOptions, allowedConnection } = require('./regression-network.cjs');
const root = resolve(__dirname, '../..');
function evidence() {
  return { version: 'm5.5-regression-v1', action: 'run', outcome: 'PASS', scope: SCOPE,
    regressionVerified: true, browserVerified: false, nativeVerified: false, providerOperations: false,
    productionActivated: false, milestoneComplete: false, runtime: { node: '24.15.0', platform: 'linux' },
    networkPolicy: 'OWNED_LOOPBACK_AND_GOOGLE_FONT_DOWNLOADS_ONLY', networkDenials: 0,
    fixture: { mode: 'STATIC_BUILD_503_NOT_REAL_API' }, candidate: { sha256: 'a'.repeat(64), fileCount: 100 },
    tasks: TASKS.map(task => ({ task, outcome: 'PASS', exitCode: 0, cached: false, durationMs: 1, logSha256: 'b'.repeat(64) })),
    jest: { tests: 889, suites: 90, testFiles: 90, inventorySha256: 'd'.repeat(64), skipped: 0, todo: 0, failed: 0,
      coverageCollected: true, reportSha256: 'c'.repeat(64) } };
}
function checkout() {
  const directory = mkdtempSync(resolve(tmpdir(), 'm5-regression-checkout-'));
  for (const app of ['api', 'admin', 'client']) mkdirSync(resolve(directory, `apps/${app}`), { recursive: true });
  return directory;
}
function project(name) {
  return { name, root: `apps/${name}`, targets: {
    lint: { executor: '@nx/eslint:lint', options: { maxWarnings: { api: 180, admin: 562, client: 232 }[name] } },
    typecheck: { executor: 'nx:run-commands', options: { command: `tsc --noEmit -p apps/${name}/${name === 'api' ? 'tsconfig.app.json' : 'tsconfig.json'}` } },
    build: { executor: name === 'api' ? '@nx/webpack:webpack' : '@nx/next:build', defaultConfiguration: 'production', dependsOn: ['^build'],
      options: name === 'api' ? { target: 'node', compiler: 'tsc', outputPath: 'dist/apps/api', main: 'apps/api/src/main.ts',
        tsConfig: 'apps/api/tsconfig.app.json', webpackConfig: 'apps/api/webpack.config.js', generatePackageJson: true }
        : { outputPath: `dist/apps/${name}` },
      configurations: { production: name === 'api' ? { optimization: true, extractLicenses: true, inspect: false } : {} } },
    test: { executor: '@nx/jest:jest', options: { jestConfig: 'apps/api/jest.config.ts' } },
  } };
}
test('fixed ten original Nx targets include all apps and unfiltered API regression with coverage', () => {
  assert.equal(TASKS.length, 10); assert.equal(new Set(TASKS).size, 10);
  for (const task of TASKS) assert.deepEqual(taskArguments(task, '/private').slice(0, 4), ['nx', 'run', task, '--skipNxCache']);
  const args = taskArguments('api:test', '/private');
  assert(args.includes('--coverage') && args.includes('--runInBand') && args.includes('--json'));
  assert(!args.some(arg => /testPath|passWithNoTests|onlyChanged|bail|forceExit/.test(arg)));
  for (const task of ['api:test:ci', 'api:m5-https-test', 'api:serve', 'admin:e2e', 'client:build; deploy']) {
    assert.throws(() => taskArguments(task, '/private'), /M5_REGRESSION_TASK/);
  }
});
test('runtime guard refuses incompatible Node and unsupported cleanup platforms', () => {
  assertRegressionRuntime('24.15.0', 'linux');
  assert.throws(() => assertRegressionRuntime('24.14.0', 'linux'), /M5_NODE_BASELINE/);
  assert.throws(() => assertRegressionRuntime('24.15.0', 'win32'), /M5_REGRESSION_LINUX_RUNNER_REQUIRED/);
});
test('private Next/Nx env files block before reading them; public examples remain allowed', () => {
  const directory = checkout();
  writeFileSync(resolve(directory, '.env.example'), 'public'); assertCleanCheckout(directory);
  for (const app of ['admin', 'client']) writeFileSync(resolve(directory, `apps/${app}/.env.local.example`), 'public');
  writeFileSync(resolve(directory, '.env.test'), readFileSync(resolve(root, '.env.test')));
  assertCleanCheckout(directory);
  writeFileSync(resolve(directory, 'apps/client/.env.production.local'), 'PRIVATE_MARKER');
  assert.throws(() => assertCleanCheckout(directory), /M5_REGRESSION_PRIVATE_ENV_PRESENT/);
});
test('only the exact public root test fixture is allowed; modified and app test manifests block', () => {
  const modified = checkout();
  writeFileSync(resolve(modified, '.env.test'), readFileSync(resolve(root, '.env.test'), 'utf8') + '\nPRIVATE=changed\n');
  assert.throws(() => assertCleanCheckout(modified), /M5_REGRESSION_PRIVATE_ENV_PRESENT/);
  const app = checkout();
  writeFileSync(resolve(app, 'apps/client/.env.test'), readFileSync(resolve(root, '.env.test')));
  assert.throws(() => assertCleanCheckout(app), /M5_REGRESSION_PRIVATE_ENV_PRESENT/);
});
test('public-looking env links are rejected without following them', () => {
  const directory = checkout();
  symlinkSync(resolve(directory, 'apps/client'), resolve(directory, '.env.local.example'), 'junction');
  assert.throws(() => assertCleanCheckout(directory), /M5_REGRESSION_PRIVATE_ENV_PRESENT/);
});
test('synthetic child environment cannot inherit provider keys, DB, TLS bypass or caller test filters', () => {
  const previous = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, NODE_OPTIONS: process.env.NODE_OPTIONS,
    DATABASE_URL: process.env.DATABASE_URL, NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    NX_TASKS_RUNNER_DYNAMIC_OUTPUT: process.env.NX_TASKS_RUNNER_DYNAMIC_OUTPUT };
  try {
    Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_live_PRIVATE', DATABASE_URL: 'production',
      NODE_OPTIONS: '--require=untrusted', NODE_TLS_REJECT_UNAUTHORIZED: '0', NX_TASKS_RUNNER_DYNAMIC_OUTPUT: 'untrusted' });
    const env = regressionEnvironment(root, 13002, '/private');
    assert.equal(env.STRIPE_SECRET_KEY, ''); assert.equal(env.PAYPAL_CLIENT_ID, ''); assert.equal(env.PAYPAL_CLIENT_SECRET, '');
    assert.equal(env.NODE_TLS_REJECT_UNAUTHORIZED, undefined); assert(!JSON.stringify(env).includes('sk_live_PRIVATE'));
    assert.equal(env.DATABASE_URL, 'postgresql://synthetic:invalid@127.0.0.1:9/m5_regression_not_a_database');
    for (const key of ['ECONOMIC_V1_ENABLED', 'ECONOMIC_REFUNDS_ENABLED', 'ECONOMIC_CONSUMERS_ENABLED', 'ECONOMIC_POD_ENABLED', 'ECONOMIC_EMAIL_ENABLED']) assert.equal(env[key], 'false');
    assert.equal(env.API_URL, 'http://127.0.0.1:13002'); assert.equal(env.NX_LOAD_DOT_ENV_FILES, 'false');
    assert.match(env.NODE_OPTIONS, /regression-network\.cjs/); assert.equal(env.NX_TASKS_RUNNER_DYNAMIC_OUTPUT, undefined);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('resolved targets preserve original executors, full test options and lint budgets', () => {
  for (const name of ['api', 'admin', 'client']) {
    const original = project(name); assertResolvedProject(original, name);
    const higher = structuredClone(original); higher.targets.lint.options.maxWarnings++;
    assert.throws(() => assertResolvedProject(higher, name), /M5_REGRESSION_TARGET_CHANGED/);
    const skip = structuredClone(original); skip.targets.build.executor = 'nx:noop';
    assert.throws(() => assertResolvedProject(skip, name), /M5_REGRESSION_TARGET_CHANGED/);
    const narrowed = structuredClone(original); narrowed.targets.lint.options.lintFilePatterns = ['single-fixture.ts'];
    assert.throws(() => assertResolvedProject(narrowed, name), /M5_REGRESSION_TARGET_CHANGED/);
    const shortcut = structuredClone(original); shortcut.targets.build.configurations.production.skipTypeCheck = true;
    assert.throws(() => assertResolvedProject(shortcut, name), /M5_REGRESSION_BUILD_CHANGED/);
  }
  for (const key of ['testPathPatterns', 'passWithNoTests', 'testNamePattern', 'onlyChanged']) {
    const filtered = project('api'); filtered.targets.test.options[key] = true;
    assert.throws(() => assertResolvedProject(filtered, 'api'), /M5_REGRESSION_TEST_FILTER/);
  }
});
function jestReport() {
  return { success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0, numPendingTestSuites: 0, numRuntimeErrorTestSuites: 0,
    coverageMap: { 'synthetic.ts': {} }, testResults: [{ name: '/fixture/synthetic.spec.ts' }], extraPrivateField: 'PRIVATE_TEST_LOG_DO_NOT_EXPORT' };
}
const testInventory = { files: ['/fixture/synthetic.spec.ts'], sha256: 'a'.repeat(64) };
test('Jest summary requires tests, suites, zero skips/todos/errors and coverage, without raw test fields', () => {
  const result = jestSummary(JSON.stringify(jestReport()), testInventory);
  assert.equal(result.tests, 1); assert.equal(result.suites, 1); assert.equal(result.coverageCollected, true);
  assert(!JSON.stringify(result).includes('PRIVATE_TEST_LOG'));
  for (const change of [{ success: false }, { numTotalTests: 0 }, { numPendingTests: 1 }, { numTodoTests: 1 },
    { numFailedTests: 1 }, { numRuntimeErrorTestSuites: 1 }, { testResults: [] }, { coverageMap: {} }]) {
    assert.throws(() => jestSummary(JSON.stringify({ ...jestReport(), ...change }), testInventory), /M5_REGRESSION_JEST_INCOMPLETE/);
  }
});
test('filesystem test inventory detects filtered-out suites rather than trusting aggregate PASS', () => {
  const inventory = apiTestInventory(root);
  assert(inventory.files.length > 80); assert.match(inventory.sha256, /^[a-f0-9]{64}$/);
  assert(inventory.files.some(file => file.endsWith('m5-https-boundary.spec.ts')));
  const expanded = { ...testInventory, files: [...testInventory.files, '/fixture/unexecuted.spec.ts'] };
  assert.throws(() => jestSummary(JSON.stringify(jestReport()), expanded), /M5_REGRESSION_JEST_FILTERED/);
  assert.throws(() => jestSummary(JSON.stringify(jestReport()), undefined), /M5_REGRESSION_JEST_FILTERED/);
});
test('ten exit-zero claims must be uncached, complete, current and code-only', () => {
  const report = evidence(); assertRegressionEvidence(report, report.candidate);
  for (const change of [{ action: 'doctor' }, { outcome: 'BLOCKED' }, { regressionVerified: false },
    { browserVerified: true }, { nativeVerified: true }, { providerOperations: true }, { milestoneComplete: true },
    { tasks: report.tasks.slice(1) }, { tasks: report.tasks.map(row => ({ ...row, cached: true })) },
    { tasks: report.tasks.map(row => ({ ...row, exitCode: 1 })) }, { networkDenials: 1 },
    { jest: { ...report.jest, coverageCollected: false } }, { candidate: { ...report.candidate, sha256: 'd'.repeat(64) } }]) {
    assert.throws(() => assertRegressionEvidence({ ...report, ...change }, report.candidate));
  }
});
test('network guard understands real socket call shapes but denies provider, private IP and infra ports', () => {
  assert.deepEqual(connectionOptions([13002, '127.0.0.1']), { port: 13002, host: '127.0.0.1' });
  assert.deepEqual(connectionOptions([[{ port: 443, host: 'api.stripe.com' }, () => undefined]]), { port: 443, host: 'api.stripe.com' });
  const owned = new Set([12345]);
  assert(allowedConnection({ port: 12345, host: '127.0.0.1' }, owned, 13002));
  assert(allowedConnection({ port: 13002, host: '127.0.0.1' }, owned, 13002));
  assert(allowedConnection({ port: 443, host: 'fonts.gstatic.com' }, owned, 13002));
  for (const options of [{ port: 5432, host: '127.0.0.1' }, { port: 15432, host: 'localhost' }, { port: 9, host: '127.0.0.1' },
    { port: 443, host: 'api.stripe.com' }, { port: 443, host: 'api-m.sandbox.paypal.com' }, { port: 80, host: '169.254.169.254' },
    { port: 443, host: 'fonts.gstatic.com.evil.test' }, { path: '/private/socket' }]) assert.equal(allowedConnection(options, owned, 13002), false);
});
test('actual child preload allows its loopback HTTP server and blocks external TCP before connection (UNIT)', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'm5-regression-network-'));
  writeFileSync(resolve(directory, 'network-denials.txt'), '', { flag: 'wx' });
  const source = `const http=require('node:http'),net=require('node:net');
    try{net.connect({host:'api.stripe.com',port:443});throw new Error('not blocked')}catch(e){if(e.message!=='M5_REGRESSION_EGRESS_DENIED')throw e}
    const server=http.createServer((req,res)=>res.end('owned')).listen(0,'127.0.0.1',()=>{
      http.get('http://127.0.0.1:'+server.address().port,res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{if(text!=='owned')process.exitCode=1;server.close()})})});`;
  const result = spawnSync(process.execPath, ['--require', resolve(root, 'scripts/m5/regression-network.cjs'), '-e', source],
    { env: { ...process.env, NODE_OPTIONS: '', M5_REGRESSION_FIXTURE_PORT: '13002', M5_REGRESSION_PRIVATE_DIRECTORY: directory },
      windowsHide: true, timeout: 10_000, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(resolve(directory, 'network-denials.txt'), 'utf8'), 'DENIED\n');
});
test('regression CLI contains no browser mocks, fixture reset, caller shell string or threshold weakening', () => {
  const source = readFileSync(resolve(__dirname, 'regression-run.cjs'), 'utf8');
  assert(!/shell:\s*true|taskkill|DROP\s|TRUNCATE\s|deleteMany\(|dotenv\.config|passWithNoTests|forceExit/.test(source));
  assert(source.includes("spawn('pnpm', args")); assert(source.includes("flag: 'wx'"));
  assert(source.indexOf("if (report.steps.some") < source.indexOf('createServer('));
});
test('manual isolated CI neither receives secrets nor deploys, and only uploads sanitized artifacts', () => {
  const yaml = require(require.resolve('yaml', { paths: [require.resolve('nx')] }));
  const source = readFileSync(resolve(root, '.github/workflows/m5-regression.yml'), 'utf8'), workflow = yaml.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.permissions.contents, 'read'); assert.equal(workflow.jobs.regression['runs-on'], 'ubuntu-latest');
  assert(!/secrets\.|deploy\.sh|tmp\/m5|NODE_TLS_REJECT_UNAUTHORIZED/.test(source));
  assert(source.includes('api:m5-regression --skipNxCache')); assert(source.includes('artifacts/m5/*.json'));
});
module.exports = { evidence };
