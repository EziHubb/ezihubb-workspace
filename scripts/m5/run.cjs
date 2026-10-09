const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, copyFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { PROJECT, DATABASES, SCENARIO_DATABASE, BEFORE_M4, parseEnv, assertRuntime, assertEnvironment, generateEnvironment,
  cleanChildEnvironment, migrationManifest, assertDatabaseIdentity, IMAGES, assertDockerEndpoint, assertComposeConfig, assertOwnedContainers, safeFailureDetails } = require('./guard.cjs');

const root = resolve(__dirname, '../..');
const envPath = resolve(root, '.env.m5.local');
const { waitForDatabaseIdentity } = require('./readiness.cjs');
const { withOwnedLoopbackRelays } = require('./loopback-relay.cjs');
const { sourceChecksums, findFoundationEvidence, assertContentionEvidence } = require('./evidence.cjs');
const report = { version: 'm5.1-v1', runId: randomBytes(12).toString('hex'), startedAt: new Date().toISOString(),
  scope: 'LOCAL_SYNTHETIC_FOUNDATION_ONLY', steps: [], productionActivated: false, providerOperations: false, foundationVerified: false, contentionVerified: false,
  nodeRuntime: process.versions.node, expectedNode: '>=24.15.0 <25', expectedImages: IMAGES,
  sourceChecksums: sourceChecksums(root) };
function step(name, outcome, extra = {}) { report.steps.push({ name, outcome, ...extra }); }
function command(file, args, env, code) {
  const result = spawnSync(file, args, { cwd: root, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(code);
  // Child output may contain DSNs/provider replies. Never log it, even on errors.
  return result.stdout;
}
function localDockerContext(env) {
  const clean = cleanChildEnvironment(env);
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || process.env.COMPOSE_FILE || process.env.COMPOSE_PROJECT_NAME) throw new Error('M5_AMBIENT_DOCKER_OVERRIDE');
  const context = command('docker', ['context', 'show'], clean, 'M5_DOCKER_UNAVAILABLE').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(context)) throw new Error('M5_DOCKER_CONTEXT');
  const info = JSON.parse(command('docker', ['context', 'inspect', context], clean, 'M5_DOCKER_CONTEXT'));
  assertDockerEndpoint(info);
  command('docker', ['--context', context, 'info', '--format', '{{.ServerVersion}}'], clean, 'M5_DOCKER_UNAVAILABLE');
  return context;
}
function composeArgs(context, action) {
  return ['--context', context, 'compose', '--project-name', PROJECT, '--env-file', envPath, '--file', resolve(root, 'docker/m5/compose.yml'), ...action];
}
function prisma(env, database, args, migrations) {
  const child = cleanChildEnvironment(env, database);
  if (migrations) child.M5_MIGRATIONS_PATH = migrations;
  return command(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', ...args,
    '--config', resolve(root, 'scripts/m5/prisma.config.ts')], child, 'M5_PRISMA_COMMAND_FAILED');
}
async function databaseVerification(env, database, manifest) {
  report.activeStage = 'database-client-setup';
  report.activeDatabase = database; // Fixed local database identifiers only.
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');
  const { seedFixtures, verifyFixtureReceipt } = require('./fixtures.cjs');
  const child = cleanChildEnvironment(env, database);
  const pool = new Pool({ connectionString: child.DATABASE_URL, connectionTimeoutMillis: 5000, max: 3,
    options: '-c statement_timeout=60000 -c lock_timeout=10000' });
  const db = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  try {
    report.activeStage = 'database-identity';
    await waitForDatabaseIdentity(pool, env, database);
    report.activeStage = 'database-history-preflight';
    const names = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
    if (names.length && !names.includes('_prisma_migrations')) throw new Error('M5_UNMANAGED_SCHEMA');
    const existing = names.includes('_prisma_migrations') ? (await pool.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows : [];
    for (const row of existing) {
      if (!row.finished_at || row.rolled_back_at || !manifest.some(m => m.name === row.migration_name && m.checksum === row.checksum)) throw new Error('M5_MIGRATION_HISTORY');
    }
    const priorReceipt = (await pool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-foundation-fixtures-v1'])).rows[0]?.payload;
    if (names.includes('User') && (await pool.query('SELECT count(*)::int AS count FROM "User"')).rows[0].count > 0 && !priorReceipt) {
      throw new Error('M5_DATABASE_NOT_EMPTY');
    }
    if (priorReceipt) await verifyFixtureReceipt(db, priorReceipt);
    const upgrade = database === DATABASES[1];
    if (upgrade && !existing.length) {
      mkdirSync(resolve(root, 'tmp/m5'), { recursive: true });
      const subset = mkdtempSync(resolve(root, 'tmp/m5/before-m4-'));
      const before = manifest.filter(row => row.name <= BEFORE_M4);
      if (!before.some(row => row.name === BEFORE_M4)) throw new Error('M5_BASELINE_MISSING');
      copyFileSync(resolve(root, 'prisma/migrations/migration_lock.toml'), join(subset, 'migration_lock.toml'));
      for (const row of before) {
        mkdirSync(join(subset, row.name));
        copyFileSync(resolve(root, 'prisma/migrations', row.name, 'migration.sql'), join(subset, row.name, 'migration.sql'));
      }
      report.activeStage = 'upgrade-baseline-migration';
      prisma(env, database, ['deploy'], subset);
      report.activeStage = 'upgrade-baseline-fixtures';
      const receipt = await seedFixtures(db, pool, env, database);
      step('upgrade-baseline-and-synthetic-fixtures', 'PASS', { snapshotHash: receipt.snapshotHash });
    } else if (upgrade) {
      if (!priorReceipt || priorReceipt.seededMigrationHead !== BEFORE_M4) throw new Error('M5_UPGRADE_BASELINE_NOT_PROVEN');
    }
    report.activeStage = 'full-migration-chain';
    prisma(env, database, ['deploy']);
    report.activeStage = 'synthetic-fixtures';
    const fixture = await seedFixtures(db, pool, env, database);
    const rows = (await pool.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
    if (rows.length !== manifest.length || rows.some((row, i) => row.migration_name !== manifest[i].name
      || row.checksum !== manifest[i].checksum || !row.finished_at || row.rolled_back_at)) throw new Error('M5_MIGRATION_HISTORY');
    report.activeStage = 'migration-noop-and-fixture-replay';
    // Second deploy is a no-op; fixture replay must read and verify, never reset.
    prisma(env, database, ['deploy']);
    const replay = await seedFixtures(db, pool, env, database);
    if (JSON.stringify(replay) !== JSON.stringify(fixture)) throw new Error('M5_FIXTURE_CHANGED');
    report.activeStage = 'schema-contract';
    const nano = (await pool.query('SELECT nanoid(12) AS id')).rows[0].id;
    if (!/^[a-zA-Z0-9]{12}$/.test(nano)) throw new Error('M5_NANOID_DEFAULT');
    for (const table of ['EconomicOrderContext', 'EconomicOperation', 'EconomicCapture', 'EconomicRefund', 'EconomicOutbox', 'EconomicConsumerReceipt']) {
      if (!(await pool.query('SELECT to_regclass($1) AS relation', [`public."${table}"`])).rows[0].relation) throw new Error('M5_SCHEMA_CONTRACT');
    }
    const guards = (await pool.query("SELECT proname FROM pg_proc WHERE proname IN ('economic_refund_intent_guard','economic_shipping_external_handoff_guard')")).rows;
    if (guards.length !== 2) throw new Error('M5_SCHEMA_CONTRACT');
    report.activeStage = 'prisma-schema-diff';
    prisma(env, database, ['diff', '--from-config-datasource', '--to-schema', resolve(root, 'prisma/schema.prisma'), '--exit-code']);
    step(upgrade ? 'native-postgresql-upgrade-chain' : 'native-postgresql-fresh-chain', 'PASS',
      { database, migrationCount: rows.length, fixtureIds: fixture.ids, snapshotHash: fixture.snapshotHash, prismaSchemaDiff: 'EMPTY' });
  } finally { await db.$disconnect(); await pool.end(); }
}
async function infrastructureVerification(env) {
  report.activeStage = 'local-infrastructure-connectivity';
  delete report.activeDatabase;
  const Redis = require('ioredis');
  const mongoose = require('mongoose');
  const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const mailer = require('nodemailer');
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 0, retryStrategy: () => null });
  let redisFailed = false;
  redis.on('error', () => { redisFailed = true; }); // Never emit raw URLs/driver replies.
  const mongo = mongoose.createConnection();
  const s3 = new S3Client({ endpoint: env.AWS_S3_ENDPOINT, region: env.AWS_S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, maxAttempts: 1 });
  const smtp = mailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: false,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000 });
  try {
    await redis.connect();
    if (await redis.ping() !== 'PONG' || redisFailed) throw new Error('M5_REDIS_PROBE');
    await mongo.openUri(env.MONGODB_URI, { authSource: 'admin', serverSelectionTimeoutMS: 5000 }); await mongo.db.command({ ping: 1 });
    try { await s3.send(new CreateBucketCommand({ Bucket: env.AWS_S3_BUCKET }), { abortSignal: AbortSignal.timeout(5000) }); }
    catch (error) { if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) throw error; }
    await s3.send(new HeadBucketCommand({ Bucket: env.AWS_S3_BUCKET }), { abortSignal: AbortSignal.timeout(5000) });
    await smtp.verify(); // Connect/auth only, no message or provider delivery claim.
    step('local-redis-mongo-storage-mail-connectivity', 'PASS', { scope: 'PROBES_ONLY_NOT_HTTPS_OR_DELIVERY' });
  } finally { redis.disconnect(); await mongo.close(); s3.destroy(); smtp.close(); }
}
async function contentionVerification(env, manifest) {
  // The owner explicitly requested M5.2. Local synthetic contention is now in
  // scope; the old skip is NOT interpreted as provider/live activation approval.
  const foundationId = findFoundationEvidence(root, report.sourceChecksums, manifest);
  report.foundationRunId = foundationId;
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');
  const { verifyFixtureReceipt } = require('./fixtures.cjs');
  // Recheck both accepted databases read-only; M5.2 never mutates their fixtures.
  for (const database of DATABASES) {
    const pool = new Pool({ connectionString: cleanChildEnvironment(env, database).DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
    const db = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
    try {
      await assertDatabaseIdentity(pool, env, database);
      const receipt = (await pool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-foundation-fixtures-v1'])).rows[0]?.payload;
      if (!receipt) throw new Error('M5_FOUNDATION_FIXTURES_REQUIRED');
      await verifyFixtureReceipt(db, receipt);
    } finally { await db.$disconnect(); await pool.end(); }
  }
  const child = cleanChildEnvironment(env, SCENARIO_DATABASE);
  const pool = new Pool({ connectionString: child.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  try {
    await assertDatabaseIdentity(pool, env, SCENARIO_DATABASE);
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
    if (tables.length && !tables.includes('_prisma_migrations')) throw new Error('M5_UNMANAGED_SCHEMA');
    const history = tables.length ? (await pool.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows : [];
    if (history.some(row => !row.finished_at || row.rolled_back_at || !manifest.some(m => m.name === row.migration_name && m.checksum === row.checksum))) throw new Error('M5_MIGRATION_HISTORY');
    const receipt = (await pool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-scenarios-owner-v1'])).rows[0]?.payload;
    if (receipt && receipt.version !== 'm5-scenarios-owner-v1') throw new Error('M5_SCENARIO_OWNERSHIP');
    if (!receipt) {
      for (const table of tables.filter(name => name !== '_prisma_migrations')) {
        if (!/^[A-Za-z0-9_]+$/.test(table) || (await pool.query(`SELECT EXISTS(SELECT 1 FROM "${table}") AS present`)).rows[0].present) throw new Error('M5_DATABASE_NOT_EMPTY');
      }
      // Ownership receipt is append-only and stored outside the application schema.
      await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
        ['m5-scenarios-owner-v1', JSON.stringify({ version: 'm5-scenarios-owner-v1', createdByRunId: report.runId, scope: 'SYNTHETIC_ONLY' })]);
    }
    prisma(env, SCENARIO_DATABASE, ['deploy']);
    const rows = (await pool.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
    if (rows.length !== manifest.length || rows.some((row, i) => row.migration_name !== manifest[i].name || row.checksum !== manifest[i].checksum || !row.finished_at || row.rolled_back_at)) throw new Error('M5_MIGRATION_HISTORY');
    step('dedicated-scenario-database-and-full-migration-history', 'PASS');
    const output = command(process.execPath, ['--import', 'tsx', resolve(root, 'scripts/m5/contention.ts'), report.runId, foundationId], child, 'M5_CONTENTION_FAILED');
    const result = JSON.parse(output);
    const names = require('./scenario-contract.json');
    if (result.outcome === 'FAIL' && names.includes(result.failedCase)) {
      step('native-scenario', 'FAIL', { name: result.failedCase });
      step('remaining-native-scenarios', 'NOT_RUN');
      throw new Error('M5_CONTENTION_CASE_FAILED');
    }
    report.cases = assertContentionEvidence(result, report.runId, foundationId);
    await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
      [`m5-scenarios-run:${report.runId}`, JSON.stringify({ version: 'm5.2-cases-v1', runId: report.runId, foundationId, outcome: 'PASS', caseCount: report.cases.length })]);
    report.contentionVerified = true;
    step('native-prisma-multi-session-business-invariants', 'PASS', { caseCount: result.cases.length, providerEvidence: 'SYNTHETIC_TEST_ONLY' });
  } finally { await pool.end(); }
}
async function main() {
  const action = process.argv[2];
  if (process.argv.length !== 3 || !['init', 'doctor', 'up', 'stop', 'verify', 'contention'].includes(action)) throw new Error('M5_ACTION');
  report.action = action;
  if (action === 'contention') { report.version = 'm5.2-v1'; report.scope = 'LOCAL_SYNTHETIC_CONTENTION_ONLY'; }
  if (action === 'init') {
    assertRuntime();
    const env = assertEnvironment(generateEnvironment());
    writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}="${value}"`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    step('private-local-environment-created', 'PASS', { file: '.env.m5.local', credentialsPrinted: false });
    return;
  }
  if (action === 'doctor') {
    try { assertRuntime(); step('runtime-baseline', 'PASS'); } catch { step('runtime-baseline', 'BLOCKED', { code: 'M5_NODE_BASELINE' }); }
    if (!existsSync(envPath)) {
      step('local-manifest', 'BLOCKED', { code: 'M5_MANIFEST_MISSING' });
      try { localDockerContext(generateEnvironment()); step('local-docker-daemon', 'PASS'); }
      catch (error) { step('local-docker-daemon', 'BLOCKED', { code: /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_DOCKER_UNAVAILABLE' }); }
      return;
    }
  } else assertRuntime();
  const env = assertEnvironment(parseEnv(readFileSync(envPath, 'utf8')));
  step('local-manifest-no-live-provider-and-gates-off', 'PASS');
  const context = localDockerContext(env);
  step('local-docker-daemon', 'PASS');
  const resolved = JSON.parse(command('docker', composeArgs(context, ['config', '--format', 'json']), cleanChildEnvironment(env), 'M5_COMPOSE_FAILED'));
  assertComposeConfig(resolved, root);
  step('rendered-compose-loopback-images-mounts', 'PASS');
  if (action === 'doctor') return;
  // Fixed file/project/context; no user arguments or ambient compose expansion.
  if (action === 'up' || action === 'stop') {
    command('docker', composeArgs(context, action === 'up' ? ['up', '-d'] : ['stop']), cleanChildEnvironment(env), 'M5_COMPOSE_FAILED');
    step(`owned-stack-${action}`, 'PASS'); return;
  }
  const containerIds = command('docker', composeArgs(context, ['ps', '-q']), cleanChildEnvironment(env), 'M5_STACK_NOT_RUNNING').trim().split(/\s+/);
  if (containerIds.length !== 5 || containerIds.some(id => !/^[a-f0-9]{12,64}$/.test(id))) throw new Error('M5_STACK_NOT_RUNNING');
  const containers = JSON.parse(command('docker', ['--context', context, 'inspect', ...containerIds], cleanChildEnvironment(env), 'M5_STACK_NOT_RUNNING'));
  assertOwnedContainers(containers);
  step('running-containers-match-owned-project-and-image-digests', 'PASS');
  report.activeStage = 'host-published-ports';
  report.hostPorts = containers.map(row => {
    const service = row.Config.Labels['com.docker.compose.service'];
    return { service, published: Object.values(row.NetworkSettings?.Ports ?? {}).some(bindings => Array.isArray(bindings) && bindings.length > 0) };
  });
  const network = JSON.parse(command('docker', ['--context', context, 'network', 'inspect', `${PROJECT}_isolated`], cleanChildEnvironment(env), 'M5_RELAY_NETWORK_IDENTITY'));
  if (!Array.isArray(network) || network.length !== 1) throw new Error('M5_RELAY_NETWORK_IDENTITY');
  await withOwnedLoopbackRelays(containers, network[0], async () => {
    report.transport = 'VERIFIED_DOCKER_PUBLICATION_OR_OWNED_LOOPBACK_RELAY';
    step('actual-owned-loopback-transport', 'PASS');
    const manifest = migrationManifest(root);
    report.migrations = manifest;
    if (action === 'contention') { await contentionVerification(env, manifest); return; }
    await databaseVerification(env, DATABASES[0], manifest);
    await databaseVerification(env, DATABASES[1], manifest);
    await infrastructureVerification(env);
    report.foundationVerified = true;
    step('m5.2-concurrency-and-m5.3-provider-https', 'NOT_RUN');
  });
}
main().then(() => {
  report.outcome = report.steps.some(s => s.outcome === 'BLOCKED') ? 'BLOCKED' : 'PASS';
}).catch(error => {
  report.outcome = 'BLOCKED';
  step('action', 'BLOCKED', { code: /^M5_[A-Z0-9_]+$/.test(error.message) ? error.message : 'M5_ACTION_FAILED', ...safeFailureDetails(error) });
}).finally(() => {
  report.completedAt = new Date().toISOString();
  const directory = resolve(root, 'artifacts/m5');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${report.runId}.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ version: report.version, action: report.action, runId: report.runId, outcome: report.outcome,
    foundationVerified: report.foundationVerified, contentionVerified: report.contentionVerified,
    reportFile: `artifacts/m5/${report.runId}.json`, steps: report.steps }, null, 2));
  process.exitCode = report.outcome === 'PASS' ? 0 : 1;
});
