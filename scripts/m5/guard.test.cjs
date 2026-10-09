const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { assertPublishedPorts, waitForDatabaseIdentity } = require('./readiness.cjs');
const { relayTargets } = require('./loopback-relay.cjs');
const { Worker } = require('node:worker_threads');
const net = require('node:net');

function relayFixture() {
  const name = 'ezihubb-m5_isolated', networkId = 'a'.repeat(64);
  const containers = Object.entries(IMAGES).map(([service, image], index) => ({
    Id: String(index + 1).repeat(64), Config: { Image: image, Labels: { 'com.docker.compose.project': 'ezihubb-m5', 'com.docker.compose.service': service } },
    State: { Running: true }, HostConfig: { PortBindings: Object.fromEntries(Object.entries(PORTS[service]).map(([port, HostPort]) => [port, [{ HostIp: '127.0.0.1', HostPort }]])) },
    NetworkSettings: { Ports: {}, Networks: { [name]: { NetworkID: networkId, IPAddress: `172.20.0.${index + 2}` } } },
  }));
  const network = { Name: name, Id: networkId, Internal: true, Driver: 'bridge', Labels: { 'com.docker.compose.project': 'ezihubb-m5' },
    Containers: Object.fromEntries(containers.map(row => [row.Id, { IPv4Address: `${row.NetworkSettings.Networks[name].IPAddress}/16` }])) };
  return { containers, network };
}
test('every production Compose service has bounded JSON logs without inspecting private environment', () => {
  const yaml = require(require.resolve('yaml', { paths: [require.resolve('nx')] }));
  const compose = yaml.parse(readFileSync(resolve(__dirname, '../../docker-compose.yml'), 'utf8'));
  assert.equal(Object.keys(compose.services).length, 6);
  for (const service of Object.values(compose.services)) {
    assert.deepEqual(service.logging, { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } });
  }
});
test('internal-network relay can target only exact owned Docker identities and fixed loopback ports', () => {
  const h = relayFixture(); const targets = relayTargets(h.containers, h.network);
  assert.equal(targets.length, 6); assert.deepEqual(targets[0], { host: '172.20.0.2', targetPort: 5432, listenPort: 15432 });
  for (const mutation of [
    state => { state.network.Internal = false; }, state => { state.network.Labels['com.docker.compose.project'] = 'production'; },
    state => { state.network.Containers.extra = {}; }, state => { state.containers[0].Config.Image = 'postgres:latest'; },
    state => { state.containers[0].NetworkSettings.Networks.evil = {}; },
    state => { state.containers[0].NetworkSettings.Networks.ezihubb_m5_isolated = { IPAddress: '8.8.8.8' }; },
    state => { state.network.Containers[state.containers[0].Id].IPv4Address = '172.20.0.99/16'; },
    state => { state.containers[0].NetworkSettings.Ports['5432/tcp'] = [{ HostIp: '0.0.0.0', HostPort: '15432' }]; },
  ]) {
    const state = relayFixture(); mutation(state);
    assert.throws(() => relayTargets(state.containers, state.network), /^Error: M5_/);
  }
  h.containers[0].NetworkSettings.Ports['5432/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '15432' }];
  assert.equal(relayTargets(h.containers, h.network).length, 5);
});
test('owned relay worker forwards actual TCP bytes, binds only loopback and closes on termination (UNIT)', { timeout: 10_000 }, async () => {
  const echo = net.createServer(socket => socket.pipe(socket));
  await new Promise(yes => echo.listen(0, '127.0.0.1', yes));
  const worker = new Worker(resolve(__dirname, 'loopback-relay-worker.cjs'), {
    workerData: [{ host: '127.0.0.1', targetPort: echo.address().port, listenPort: 0 }], env: {}, execArgv: [],
  });
  let client;
  try {
    const ready = await new Promise((yes, no) => { worker.once('message', yes); worker.once('error', no); });
    assert.equal(ready.outcome, 'READY');
    const reply = await new Promise((yes, no) => {
      client = net.connect({ host: '127.0.0.1', port: ready.ports[0] }, () => client.write('unit-proxy-bytes'));
      client.once('data', bytes => yes(bytes.toString())); client.once('error', no);
    });
    assert.equal(reply, 'unit-proxy-bytes');
    client.destroy(); await worker.terminate();
    await assert.rejects(new Promise((yes, no) => {
      const probe = net.connect({ host: '127.0.0.1', port: ready.ports[0] }, () => { probe.destroy(); yes(); });
      probe.once('error', no);
    }));
  } finally { client?.destroy(); await worker.terminate(); await new Promise(yes => echo.close(yes)); }
});

test('actual published loopback ports are required, not just declared HostConfig bindings', () => {
  const rows = Object.entries(PORTS).map(([service, ports]) => ({
    Config: { Labels: { 'com.docker.compose.service': service } },
    NetworkSettings: { Ports: Object.fromEntries(Object.entries(ports).map(([port, HostPort]) => [port, [{ HostIp: '127.0.0.1', HostPort }]])) },
  }));
  assertPublishedPorts(rows);
  for (const mutation of [r => { r[0].NetworkSettings.Ports = {}; }, r => { r[0].NetworkSettings.Ports['5432/tcp'] = null; },
    r => { r[0].NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0'; }]) {
    const changed = structuredClone(rows); mutation(changed);
    assert.throws(() => assertPublishedPorts(changed), /M5_HOST_PORT_NOT_PUBLISHED/);
  }
});
test('host readiness retries transient connection errors but never identity or auth failures', async () => {
  const env = generateEnvironment(); let attempts = 0, delays = 0;
  const pool = { query: async sql => {
    if (++attempts <= 2) throw Object.assign(new Error('PRIVATE'), { code: 'ECONNREFUSED' });
    return { rows: sql.includes('current_database') ? [{ database: DATABASES[0], role: 'ezihubb_m5', privileged: false }] : [{ token: env.M5_DATABASE_TOKEN }] };
  } };
  await waitForDatabaseIdentity(pool, env, DATABASES[0], async () => { delays++; });
  assert.equal(delays, 2);
  await assert.rejects(waitForDatabaseIdentity({ query: async () => { throw Object.assign(new Error('PRIVATE'), { code: '28P01' }); } }, env, DATABASES[0], async () => { throw new Error('must not retry'); }), /PRIVATE/);
  let refused = 0;
  await assert.rejects(waitForDatabaseIdentity({ query: async () => { refused++; throw Object.assign(new Error('unreachable'), { code: 'ECONNREFUSED' }); } }, env, DATABASES[0], () => Promise.resolve()), /unreachable/);
  assert.equal(refused, 60);
});
const { GATES, parseEnv, generateEnvironment, assertEnvironment, assertRuntime, cleanChildEnvironment,
  assertDatabaseIdentity, migrationManifest, IMAGES, PORTS, DATABASES, assertDockerEndpoint, assertComposeConfig, assertOwnedContainers, safeFailureDetails } = require('./guard.cjs');

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
