const { randomBytes, createHash } = require('node:crypto');
const { readdirSync, lstatSync, readFileSync } = require('node:fs');
const { resolve, relative } = require('node:path');
const { generateEnvironment, cleanChildEnvironment, assertRuntime } = require('./guard.cjs');

const TASKS = Object.freeze(['api:lint', 'admin:lint', 'client:lint', 'api:build:production',
  'admin:build:production', 'client:build:production', 'api:typecheck', 'admin:typecheck', 'client:typecheck', 'api:test']);
const WARNING_BUDGETS = { api: 180, admin: 562, client: 232 };
const SCOPE = 'CANDIDATE_CODE_REGRESSION_ONLY_NOT_NATIVE_BROWSER_PROVIDER';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function assertCleanCheckout(root) {
  for (const directory of ['', 'apps/api', 'apps/admin', 'apps/client']) {
    const path = resolve(root, directory);
    if (lstatSync(path).isSymbolicLink()) throw new Error('M5_REGRESSION_CHECKOUT_LINK');
    for (const name of readdirSync(path)) {
      if (name.startsWith('.env') && !['.env.example', '.env.sample'].includes(name)) throw new Error('M5_REGRESSION_PRIVATE_ENV_PRESENT');
    }
  }
}
function assertRegressionRuntime(version = process.versions.node, platform = process.platform) {
  assertRuntime(version);
  // Bounded cleanup uses a process group created by this runner on Linux. Never
  // approximate it with taskkill or a caller-provided PID on Windows.
  if (platform !== 'linux') throw new Error('M5_REGRESSION_LINUX_RUNNER_REQUIRED');
}
function regressionEnvironment(root, fixturePort, privateDirectory) {
  if (!Number.isSafeInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65535) throw new Error('M5_REGRESSION_FIXTURE_PORT');
  const origin = `http://127.0.0.1:${fixturePort}`;
  const env = cleanChildEnvironment(generateEnvironment());
  return { ...env, NODE_ENV: 'test', CI: 'true', NX_DAEMON: 'false', NX_NO_CLOUD: 'true', NX_ISOLATE_PLUGINS: 'false', NX_LOAD_DOT_ENV_FILES: 'false',
    NEXT_TELEMETRY_DISABLED: '1', API_URL: origin, NEXT_PUBLIC_API_URL: origin, APP_URL: origin, CLIENT_URL: origin,
    ADMIN_URL: origin, NEXTAUTH_URL: origin, NEXT_PUBLIC_ADMIN_URL: origin, NEXT_PUBLIC_CLIENT_URL: origin,
    NEXT_PUBLIC_SITE_URL: origin, NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    SECRETS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    // No native connectivity is intended. Socket policy also denies these ports.
    DATABASE_URL: 'postgresql://synthetic:invalid@127.0.0.1:9/m5_regression_not_a_database',
    REDIS_URL: 'redis://127.0.0.1:9/0', MONGODB_URI: 'mongodb://127.0.0.1:9/m5_regression_not_a_database',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', AWS_S3_ENDPOINT: 'http://127.0.0.1:9',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SENTRY_DSN: '', AXIOM_TOKEN: '',
    M5_REGRESSION_FIXTURE_PORT: String(fixturePort), M5_REGRESSION_PRIVATE_DIRECTORY: privateDirectory,
    NODE_OPTIONS: `--require=${JSON.stringify(resolve(root, 'scripts/m5/regression-network.cjs'))}` };
}
function taskArguments(task, privateDirectory) {
  if (!TASKS.includes(task)) throw new Error('M5_REGRESSION_TASK');
  const args = ['nx', 'run', task, '--skipNxCache'];
  if (task === 'api:test') args.push('--runInBand', '--coverage', '--json', `--outputFile=${resolve(privateDirectory, 'api-jest.json')}`);
  return args;
}
function assertResolvedProject(project, name) {
  if (project?.name !== name || project.root !== `apps/${name}`) throw new Error('M5_REGRESSION_PROJECT');
  const targets = project.targets;
  if (targets?.lint?.executor !== '@nx/eslint:lint' || !Number.isSafeInteger(targets.lint.options?.maxWarnings)
    || targets.lint.options.maxWarnings > WARNING_BUDGETS[name]
    || Object.keys(targets.lint.options).some(key => key !== 'maxWarnings') || targets.lint.defaultConfiguration
    || targets?.typecheck?.executor !== 'nx:run-commands'
    || targets.typecheck.options?.command !== `tsc --noEmit -p apps/${name}/${name === 'api' ? 'tsconfig.app.json' : 'tsconfig.json'}`
    || Object.keys(targets.typecheck.options).some(key => key !== 'command') || targets.typecheck.defaultConfiguration
    || targets?.build?.executor !== (name === 'api' ? '@nx/webpack:webpack' : '@nx/next:build')) throw new Error('M5_REGRESSION_TARGET_CHANGED');
  const buildOptions = name === 'api' ? { target: 'node', compiler: 'tsc', outputPath: 'dist/apps/api',
    main: 'apps/api/src/main.ts', tsConfig: 'apps/api/tsconfig.app.json', webpackConfig: 'apps/api/webpack.config.js', generatePackageJson: true }
    : { outputPath: `dist/apps/${name}` };
  const production = name === 'api' ? { optimization: true, extractLicenses: true, inspect: false } : {};
  function exact(actual, expected) {
    return actual && JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(expected).sort())
      && Object.entries(expected).every(([key, value]) => actual[key] === value);
  }
  if (!exact(targets.build.options, buildOptions) || !exact(targets.build.configurations?.production, production)
    || targets.build.defaultConfiguration !== 'production' || JSON.stringify(targets.build.dependsOn) !== '["^build"]') {
    throw new Error('M5_REGRESSION_BUILD_CHANGED');
  }
  if (name === 'api') {
    const options = targets?.test?.options;
    if (targets.test?.executor !== '@nx/jest:jest' || options?.jestConfig !== 'apps/api/jest.config.ts'
      || Object.keys(options).some(key => key !== 'jestConfig') || targets.test.defaultConfiguration) throw new Error('M5_REGRESSION_TEST_FILTER');
  }
}
function apiTestInventory(root) {
  const files = [];
  function walk(directory) {
    const path = resolve(root, directory);
    if (lstatSync(path).isSymbolicLink()) throw new Error('M5_REGRESSION_TEST_LINK');
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'out-tsc', 'coverage', '.nx'].includes(entry.name)) continue;
      const file = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('M5_REGRESSION_TEST_LINK');
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) files.push(resolve(root, file));
    }
  }
  walk('apps/api'); files.sort();
  if (!files.length || files.length > 10_000) throw new Error('M5_REGRESSION_TEST_INVENTORY');
  return { files, sha256: sha256(JSON.stringify(files.map(file => relative(root, file).replaceAll('\\', '/')).sort())) };
}
function jestSummary(source, inventory) {
  let report;
  try { report = JSON.parse(source); } catch { throw new Error('M5_REGRESSION_JEST_REPORT'); }
  const fields = ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests',
    'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numRuntimeErrorTestSuites'];
  if (report.success !== true || fields.some(key => !Number.isSafeInteger(report[key]) || report[key] < 0)
    || report.numTotalTests < 1 || report.numTotalTestSuites < 1
    || report.numPassedTests !== report.numTotalTests || report.numPassedTestSuites !== report.numTotalTestSuites
    || fields.filter(key => !/Total|Passed/.test(key)).some(key => report[key] !== 0)
    || !Array.isArray(report.testResults) || report.testResults.length !== report.numTotalTestSuites
    || !report.coverageMap || typeof report.coverageMap !== 'object' || Object.keys(report.coverageMap).length < 1) throw new Error('M5_REGRESSION_JEST_INCOMPLETE');
  const executed = report.testResults.map(row => row.name ?? row.testFilePath).sort();
  if (!inventory || JSON.stringify(executed) !== JSON.stringify(inventory.files)
    || !/^[a-f0-9]{64}$/.test(inventory.sha256)) throw new Error('M5_REGRESSION_JEST_FILTERED');
  return { tests: report.numTotalTests, suites: report.numTotalTestSuites, skipped: 0, todo: 0, failed: 0,
    coverageCollected: true, testFiles: inventory.files.length, inventorySha256: inventory.sha256, reportSha256: sha256(source) };
}
function readJestSummary(privateDirectory, inventory) {
  const file = resolve(privateDirectory, 'api-jest.json'), info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 * 1024) throw new Error('M5_REGRESSION_JEST_REPORT');
  return jestSummary(readFileSync(file, 'utf8'), inventory);
}
function assertRegressionEvidence(report, candidate, nodeVersion) {
  if (report?.version !== 'm5.5-regression-v1' || report.action !== 'run' || report.outcome !== 'PASS'
    || report.scope !== SCOPE || report.regressionVerified !== true || report.browserVerified !== false || report.nativeVerified !== false
    || report.providerOperations !== false || report.productionActivated !== false || report.milestoneComplete !== false
    || report.candidate?.sha256 !== candidate.sha256 || report.candidate?.fileCount !== candidate.fileCount
    || report.runtime?.platform !== 'linux' || report.networkPolicy !== 'OWNED_LOOPBACK_AND_GOOGLE_FONT_DOWNLOADS_ONLY'
    || report.networkDenials !== 0 || report.fixture?.mode !== 'STATIC_BUILD_503_NOT_REAL_API') throw new Error('M5_REGRESSION_INCOMPLETE');
  assertRegressionRuntime(report.runtime.node, report.runtime.platform);
  if (nodeVersion) assertRegressionRuntime(nodeVersion, 'linux');
  if (JSON.stringify(report.tasks?.map(row => row.task)) !== JSON.stringify(TASKS)
    || report.tasks.some(row => row.outcome !== 'PASS' || row.exitCode !== 0 || row.cached !== false
      || !Number.isFinite(row.durationMs) || row.durationMs < 0 || !/^[a-f0-9]{64}$/.test(row.logSha256 ?? ''))
    || !Number.isSafeInteger(report.jest?.tests) || report.jest.tests < 1 || !Number.isSafeInteger(report.jest?.suites) || report.jest.suites < 1
    || report.jest?.skipped !== 0 || report.jest?.failed !== 0 || report.jest?.todo !== 0 || report.jest?.coverageCollected !== true
    || report.jest?.testFiles !== report.jest?.suites || !/^[a-f0-9]{64}$/.test(report.jest?.inventorySha256 ?? '')
    || !/^[a-f0-9]{64}$/.test(report.jest?.reportSha256 ?? '')) throw new Error('M5_REGRESSION_INCOMPLETE');
}
module.exports = { TASKS, SCOPE, assertCleanCheckout, assertRegressionRuntime, regressionEnvironment,
  taskArguments, assertResolvedProject, apiTestInventory, jestSummary, readJestSummary, assertRegressionEvidence, sha256 };
