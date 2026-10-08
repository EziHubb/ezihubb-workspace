const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { GATES, parseEnv, generateEnvironment, assertEnvironment, assertRuntime, cleanChildEnvironment,
  assertDatabaseIdentity, migrationManifest, IMAGES, PORTS, assertDockerEndpoint, assertComposeConfig, assertOwnedContainers, safeFailureDetails } = require('./guard.cjs');

test('failure diagnostics export only allowlisted driver codes, never raw errors or metadata', () => {
  for (const code of ['P2021', '42P01', '23505', 'ECONNREFUSED']) {
    assert.deepEqual(safeFailureDetails({ code, message: 'PRIVATE', stack: 'PRIVATE', meta: { secret: 'PRIVATE' } }), { driverCode: code });
  }
  for (const code of ['postgresql://private', 'PRIVATE_SECRET', 'P2021\nPRIVATE', undefined]) {
    assert.deepEqual(safeFailureDetails({ code, message: 'PRIVATE' }), {});
  }
  assert.deepEqual(safeFailureDetails({ name: 'PrismaClientValidationError', message: 'PRIVATE' }), { driverType: 'PrismaClientValidationError' });
  assert.deepEqual(safeFailureDetails({ name: 'PRIVATE', message: 'PRIVATE' }), {});
});

test('generated environment has private independent secrets and round-trips without interpolation', () => {
  const env = generateEnvironment(), other = generateEnvironment();
  assertEnvironment(env);
  assert.notEqual(env.M5_DATABASE_TOKEN, other.M5_DATABASE_TOKEN);
  assert.notEqual(env.M5_APP_PASSWORD, env.M5_BOOTSTRAP_PASSWORD);
  assert.deepEqual(parseEnv(Object.entries(env).map(([k, v]) => `${k}="${v}"`).join('\n')), env);
});
test('runtime enforces the pinned major/minimum without claiming local Node is upgraded', () => {
  for (const version of ['24.15.0', '24.16.1']) assertRuntime(version);
  for (const version of ['24.14.0', '22.16.0', '25.1.0', 'invalid', '24.15']) assert.throws(() => assertRuntime(version), /M5_NODE_BASELINE/);
});
test('rejects duplicate, interpolated, shell-style and malformed environment entries', () => {
  for (const source of ['KEY=a\nKEY=b', 'KEY=$OTHER', 'KEY=`command`', 'export KEY=a', 'KEY=a\\b', 'not-env']) {
    assert.throws(() => parseEnv(source), /M5_INVALID_ENV_FILE/);
  }
});
for (const [name, mutation] of [
  ['RDS endpoint', env => { env.DATABASE_URL = env.DATABASE_URL.replace('127.0.0.1', 'prod.rds.amazonaws.com'); }],
  ['production DB on loopback', env => { env.DATABASE_URL = env.DATABASE_URL.replace('ezihubb_m5_fresh', 'ezihubb'); }],
  ['default PG port', env => { env.DATABASE_URL = env.DATABASE_URL.replace('15432', '5432'); }],
  ['superuser credentials', env => { env.DATABASE_URL = env.DATABASE_URL.replace('ezihubb_m5:', 'postgres:'); }],
  ['schema/ssl options', env => { env.DATABASE_URL += '?schema=production'; }],
  ['second database remote', env => { env.M5_UPGRADE_DATABASE_URL = env.M5_UPGRADE_DATABASE_URL.replace('127.0.0.1', 'prod.example'); }],
  ['Redis default', env => { env.REDIS_URL = 'redis://127.0.0.1:6379/0'; }],
  ['Mongo Atlas', env => { env.MONGODB_URI = 'mongodb+srv://prod.example/ezihubb'; }],
  ['S3 production', env => { env.AWS_S3_ENDPOINT = 'https://s3.amazonaws.com/'; }],
  ['S3 real credentials', env => { env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE'; }],
  ['external SMTP', env => { env.SMTP_HOST = 'smtp.example.com'; }],
  ['production client', env => { env.APP_URL = 'https://ezihubb.com/'; }],
  ['live mode', env => { env.ECONOMIC_V1_MODE = 'LIVE'; }],
  ['live PayPal', env => { env.PAYPAL_MODE = 'live'; }],
  ['Stripe credential', env => { env.STRIPE_SECRET_KEY = 'sk_live_fake'; }],
  ['sandbox credentials premature', env => { env.PAYPAL_CLIENT_SECRET = 'sandbox-secret'; }],
  ['payout destination', env => { env.ECONOMIC_PAYOUT_DESTINATIONS = '[{}]'; }],
  ['injected Docker environment', env => { env.DOCKER_HOST = 'ssh://production'; }],
  ['injected node startup code', env => { env.NODE_OPTIONS = '--require malware.js'; }],
]) test(`fails closed before I/O: ${name}`, () => {
  const env = generateEnvironment(); mutation(env);
  assert.throws(() => assertEnvironment(env), /^Error: M5_/);
});
for (const gate of GATES) test(`does not activate ${gate}`, () => {
  const env = generateEnvironment(); env[gate] = 'true';
  assert.throws(() => assertEnvironment(env), /M5_ACTIVATION_GATE/);
});
test('child commands cannot inherit provider secrets, Docker routing or production DB from ambient env', () => {
  const original = { DATABASE_URL: process.env.DATABASE_URL, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    DOCKER_HOST: process.env.DOCKER_HOST, AWS_PROFILE: process.env.AWS_PROFILE };
  try {
    Object.assign(process.env, { DATABASE_URL: 'production-secret', STRIPE_SECRET_KEY: 'sk_live_fake',
      DOCKER_HOST: 'ssh://production', AWS_PROFILE: 'production' });
    const env = generateEnvironment();
    const child = cleanChildEnvironment(env, 'ezihubb_m5_upgrade');
    assert.equal(child.DATABASE_URL, env.M5_UPGRADE_DATABASE_URL);
    assert.equal(child.STRIPE_SECRET_KEY, '');
    assert.equal(child.DOCKER_HOST, undefined);
    assert.equal(child.AWS_PROFILE, undefined);
    assert.throws(() => cleanChildEnvironment(env, 'production'), /M5_DATABASE_IDENTITY/);
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('database identity requires nonprivileged app role and exact protected marker, not just localhost', async () => {
  const env = generateEnvironment(); let calls = 0;
  const client = { query: async () => ({ rows: ++calls === 1 ? [{ database: 'ezihubb_m5_fresh', role: 'ezihubb_m5', privileged: false }]
    : [{ token: env.M5_DATABASE_TOKEN }] }) };
  await assertDatabaseIdentity(client, env, 'ezihubb_m5_fresh');
  for (const identity of [{ database: 'prod', role: 'ezihubb_m5', privileged: false },
    { database: 'ezihubb_m5_fresh', role: 'postgres', privileged: true }, { database: 'ezihubb_m5_fresh', role: 'ezihubb_m5', privileged: true }]) {
    let writes = 0;
    await assert.rejects(assertDatabaseIdentity({ query: async () => { writes++; return { rows: [identity] }; } }, env, 'ezihubb_m5_fresh'), /M5_DATABASE_IDENTITY/);
    assert.equal(writes, 1);
  }
  calls = 0;
  await assert.rejects(assertDatabaseIdentity({ query: async () => ({ rows: ++calls === 1
    ? [{ database: 'ezihubb_m5_fresh', role: 'ezihubb_m5', privileged: false }] : [{ token: 'different' }] }) }, env, 'ezihubb_m5_fresh'), /M5_DATABASE_MARKER/);
});
test('full migration manifest is ordered, checksummed and includes final M4 override', () => {
  const manifest = migrationManifest(resolve(__dirname, '../..'));
  assert(manifest.length > 12);
  assert.equal(manifest[0].name, '20260823060000_init');
  assert(manifest.some(row => row.name === '20261008170000_economic_shipping_override'));
  assert(manifest.every(row => /^[a-f0-9]{64}$/.test(row.checksum)));
  assert.deepEqual(manifest.map(row => row.name), [...manifest.map(row => row.name)].sort());
});
test('isolated compose is digest pinned, loopback-only and never imports production configuration', () => {
  const source = readFileSync(resolve(__dirname, '../../docker/m5/compose.yml'), 'utf8');
  assert.equal((source.match(/image: .*@sha256:[a-f0-9]{64}/g) ?? []).length, 5);
  assert.equal((source.match(/127\.0\.0\.1:/g) ?? []).length, 6);
  assert(!/container_name:|external:|docker\.sock|env_file:|\.env\b|build:/.test(source));
  assert.match(source, /internal: true/);
  const run = readFileSync(resolve(__dirname, './run.cjs'), 'utf8');
  assert(!/deploy\.sh|db:reset|down.*--volumes/.test(run));
});
test('Docker identity rejects remote and ambiguous context endpoints', () => {
  for (const host of ['unix:///var/run/docker.sock', 'npipe:////./pipe/docker_engine']) assertDockerEndpoint([{ Endpoints: { docker: { Host: host } } }]);
  for (const host of ['ssh://production', 'tcp://production:2376', 'http://localhost:2375', '']) {
    assert.throws(() => assertDockerEndpoint([{ Endpoints: { docker: { Host: host } } }]), /M5_REMOTE_DOCKER/);
  }
  assert.throws(() => assertDockerEndpoint([]), /M5_REMOTE_DOCKER/);
});
function renderedCompose() {
  return { name: 'ezihubb-m5', networks: { isolated: { internal: true } },
    services: Object.fromEntries(Object.entries(IMAGES).map(([name, image]) => [name, { image, networks: { isolated: null },
      ports: Object.entries(PORTS[name]).map(([port, published]) => ({ published, target: Number(port.split('/')[0]), protocol: 'tcp', host_ip: '127.0.0.1' })) }])),
    volumes: { pg_data: { name: 'ezihubb-m5_pg_data' } } };
}
test('checks resolved Compose rather than trusting only source YAML', () => {
  const root = resolve(__dirname, '../..');
  assertComposeConfig(renderedCompose(), root);
  for (const mutate of [
    config => { config.name = 'production'; },
    config => { config.services.api = {}; },
    config => { config.services.postgres.image = 'postgres:latest'; },
    config => { config.services.redis.ports[0].host_ip = '0.0.0.0'; },
    config => { config.services.redis.ports[0].published = '6379'; },
    config => { config.networks.isolated.internal = false; },
    config => { config.volumes.pg_data.external = true; },
    config => { config.services.postgres.volumes = [{ type: 'bind', source: '/var/run/docker.sock', read_only: true }]; },
    config => { config.services.postgres.privileged = true; },
    config => { config.services.postgres.build = { context: '.' }; },
  ]) {
    const config = renderedCompose(); mutate(config);
    assert.throws(() => assertComposeConfig(config, root), /^Error: M5_/);
  }
});
test('native probes require actually running owned containers, not just a safe YAML file', () => {
  const containers = Object.entries(IMAGES).map(([service, image]) => ({ Config: { Image: image,
    Labels: { 'com.docker.compose.project': 'ezihubb-m5', 'com.docker.compose.service': service } },
    State: { Running: true }, HostConfig: { PortBindings: Object.fromEntries(Object.entries(PORTS[service])
      .map(([target, HostPort]) => [target, [{ HostIp: '127.0.0.1', HostPort }]])) } }));
  assertOwnedContainers(containers);
  assert.throws(() => assertOwnedContainers(containers.slice(1)), /M5_STACK_NOT_RUNNING/);
  for (const mutate of [
    rows => { rows[0].Config.Labels['com.docker.compose.project'] = 'production'; },
    rows => { rows[0].Config.Image = 'postgres:latest'; },
    rows => { rows[0].State.Running = false; },
    rows => { rows[0].HostConfig.PortBindings['5432/tcp'][0].HostIp = '0.0.0.0'; },
  ]) {
    const clone = structuredClone(containers); mutate(clone);
    assert.throws(() => assertOwnedContainers(clone), /^Error: M5_/);
  }
});
test('Compose/workflow YAML parse and hosted workflow is manual, scoped and secret-free', () => {
  // Reuse Nx's installed YAML tooling for configuration tests, not app runtime.
  const yaml = require(require.resolve('yaml', { paths: [require.resolve('nx')] }));
  const root = resolve(__dirname, '../..');
  const compose = yaml.parse(readFileSync(resolve(root, 'docker/m5/compose.yml'), 'utf8'));
  assert.equal(compose.name, 'ezihubb-m5');
  assert.equal(compose.networks.isolated.internal, true);
  for (const [name, image] of Object.entries(IMAGES)) assert.equal(compose.services[name].image, image);
  const workflowSource = readFileSync(resolve(root, '.github/workflows/m5-foundation.yml'), 'utf8');
  const workflow = yaml.parse(workflowSource);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.foundation['runs-on'], 'ubuntu-latest');
  assert.equal(workflow.permissions.contents, 'read');
  assert(!workflowSource.includes('secrets.') && !workflowSource.includes('deploy.sh'));
});
