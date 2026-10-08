const { randomBytes, createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const PROJECT = 'ezihubb-m5';
const BEFORE_M4 = '20261004090000_economic_balance_payout';
const DATABASES = ['ezihubb_m5_fresh', 'ezihubb_m5_upgrade'];
const SCENARIO_DATABASE = 'ezihubb_m5_scenarios';
const IMAGES = {
  postgres: 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  redis: 'redis@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499',
  mongo: 'mongo@sha256:f71f6d0913c945096cd058557cbadf4ad435007f378d84b3c4c636c928735e72',
  storage: 'localstack/localstack@sha256:17c2f79ca4e1f804eb912291a19713d4134806325ef0d21d4c1053161dfa72d0',
  mail: 'axllent/mailpit@sha256:b68349e3a014b90c5610bfb26b2ae36f3892d7b8cf25ee140c6c71c98d2fcf48',
};
const PORTS = { postgres: { '5432/tcp': '15432' }, redis: { '6379/tcp': '16379' }, mongo: { '27017/tcp': '17017' },
  storage: { '4566/tcp': '14566' }, mail: { '1025/tcp': '11025', '8025/tcp': '18025' } };
const GATES = ['ECONOMIC_V1_ENABLED', 'ECONOMIC_REFUNDS_ENABLED', 'ECONOMIC_CONSUMERS_ENABLED', 'ECONOMIC_POD_ENABLED', 'ECONOMIC_EMAIL_ENABLED'];
const fail = code => { throw new Error(`M5_${code}`); };

function parseEnv(source) {
  const out = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || Object.hasOwn(out, match[1])) fail('INVALID_ENV_FILE');
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    // No shell interpolation, exports, duplicate keys, comments after values or escapes.
    if (/[\r\n`$\\]/.test(value)) fail('INVALID_ENV_FILE');
    out[match[1]] = value;
  }
  return out;
}
function assertRuntime(version = process.versions.node) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0) || parts[0] !== 24 || parts[1] < 15) fail('NODE_BASELINE');
}
function localUrl(value, protocol, port, path) {
  let url;
  try { url = new URL(value); } catch { fail('INVALID_ENDPOINT'); }
  if (url.protocol !== protocol || url.hostname !== '127.0.0.1' || url.port !== port || url.pathname !== path
    || url.hash || url.search) fail('NONLOCAL_ENDPOINT');
  return url;
}
function assertEnvironment(env) {
  const allowed = new Set(Object.keys(generateEnvironment()));
  if (Object.keys(env).some(key => !allowed.has(key))) fail('UNKNOWN_ENV_KEY');
  if (env.M5_ENVIRONMENT !== 'local-synthetic-v1' || env.COMPOSE_PROJECT_NAME !== PROJECT || env.NODE_ENV !== 'development') fail('ENVIRONMENT_IDENTITY');
  for (const key of GATES) if (env[key] !== 'false') fail('ACTIVATION_GATE');
  if (env.ECONOMIC_V1_MODE !== 'TEST' || env.PAYPAL_MODE !== 'sandbox' || env.ECONOMIC_PAYOUT_DESTINATIONS !== '[]') fail('PROVIDER_MODE');
  for (const key of ['STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_WEBHOOK_ID', 'ECONOMIC_STRIPE_ACCOUNT_ID', 'ECONOMIC_PAYPAL_MERCHANT_ID']) {
    if (env[key] !== '' && env[key] !== undefined) fail('PROVIDER_CREDENTIAL');
  }
  for (const key of ['M5_DATABASE_TOKEN', 'M5_BOOTSTRAP_PASSWORD', 'M5_APP_PASSWORD', 'M5_MONGO_PASSWORD', 'M5_FIXTURE_PASSWORD']) {
    if (!/^[a-f0-9]{64}$/.test(env[key] ?? '')) fail('LOCAL_SECRET');
  }
  for (const [key, database] of [['DATABASE_URL', DATABASES[0]], ['M5_UPGRADE_DATABASE_URL', DATABASES[1]]]) {
    const url = localUrl(env[key], 'postgresql:', '15432', `/${database}`);
    if (url.username !== 'ezihubb_m5' || url.password !== env.M5_APP_PASSWORD) fail('DATABASE_IDENTITY');
  }
  const mongo = localUrl(env.MONGODB_URI, 'mongodb:', '17017', '/ezihubb_m5');
  if (mongo.username !== 'm5_mongo' || mongo.password !== env.M5_MONGO_PASSWORD) fail('MONGO_IDENTITY');
  localUrl(env.REDIS_URL, 'redis:', '16379', '/0');
  localUrl(env.AWS_S3_ENDPOINT, 'http:', '14566', '/');
  if (env.AWS_S3_BUCKET !== 'ezihubb-m5-assets' || env.AWS_S3_REGION !== 'us-east-1'
    || env.AWS_ACCESS_KEY_ID !== 'test' || env.AWS_SECRET_ACCESS_KEY !== 'test') fail('STORAGE_IDENTITY');
  if (env.SMTP_HOST !== '127.0.0.1' || env.SMTP_PORT !== '11025' || env.EMAIL_FROM !== 'm5@ezihubb.test') fail('MAIL_IDENTITY');
  for (const [key, port] of [['APP_URL', '13000'], ['ADMIN_URL', '13001'], ['API_URL', '13002']]) localUrl(env[key], 'http:', port, '/');
  return env;
}
function generateEnvironment() {
  const secret = () => randomBytes(32).toString('hex');
  const appPassword = secret(), mongoPassword = secret();
  return {
    M5_ENVIRONMENT: 'local-synthetic-v1', COMPOSE_PROJECT_NAME: PROJECT, NODE_ENV: 'development',
    M5_DATABASE_TOKEN: secret(), M5_BOOTSTRAP_PASSWORD: secret(), M5_APP_PASSWORD: appPassword, M5_MONGO_PASSWORD: mongoPassword, M5_FIXTURE_PASSWORD: secret(),
    DATABASE_URL: `postgresql://ezihubb_m5:${appPassword}@127.0.0.1:15432/${DATABASES[0]}`,
    M5_UPGRADE_DATABASE_URL: `postgresql://ezihubb_m5:${appPassword}@127.0.0.1:15432/${DATABASES[1]}`,
    MONGODB_URI: `mongodb://m5_mongo:${mongoPassword}@127.0.0.1:17017/ezihubb_m5`, REDIS_URL: 'redis://127.0.0.1:16379/0',
    AWS_S3_ENDPOINT: 'http://127.0.0.1:14566/', AWS_S3_BUCKET: 'ezihubb-m5-assets', AWS_S3_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025',
    SMTP_USER: 'm5-local', SMTP_PASS: secret(), EMAIL_FROM: 'm5@ezihubb.test',
    APP_URL: 'http://127.0.0.1:13000/', ADMIN_URL: 'http://127.0.0.1:13001/', API_URL: 'http://127.0.0.1:13002/',
    ECONOMIC_V1_MODE: 'TEST', PAYPAL_MODE: 'sandbox', ECONOMIC_PAYOUT_DESTINATIONS: '[]',
    ...Object.fromEntries(GATES.map(key => [key, 'false'])),
    STRIPE_SECRET_KEY: '', PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', STRIPE_WEBHOOK_SECRET: '', PAYPAL_WEBHOOK_ID: '',
    ECONOMIC_STRIPE_ACCOUNT_ID: '', ECONOMIC_PAYPAL_MERCHANT_ID: '',
  };
}
function cleanChildEnvironment(env, database = DATABASES[0]) {
  assertEnvironment(env);
  if (![...DATABASES, SCENARIO_DATABASE].includes(database)) fail('DATABASE_IDENTITY');
  const clean = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOME']) {
    if (process.env[key]) clean[key] = process.env[key];
  }
  const databaseUrl = new URL(database === DATABASES[1] ? env.M5_UPGRADE_DATABASE_URL : env.DATABASE_URL);
  databaseUrl.pathname = `/${database}`;
  return { ...clean, ...env, DATABASE_URL: databaseUrl.href,
    NX_DAEMON: 'false', AWS_EC2_METADATA_DISABLED: 'true', PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=10000' };
}
function migrationManifest(root) {
  return readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name))
    .map(entry => ({ name: entry.name, checksum: createHash('sha256').update(readFileSync(resolve(root, 'prisma/migrations', entry.name, 'migration.sql'))).digest('hex') }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
async function assertDatabaseIdentity(client, env, database) {
  assertEnvironment(env);
  if (![...DATABASES, SCENARIO_DATABASE].includes(database)) fail('DATABASE_IDENTITY');
  const identity = (await client.query(`SELECT current_database() AS database, current_user AS role,
    (SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user) AS privileged`)).rows[0];
  if (!identity || identity.database !== database || identity.role !== 'ezihubb_m5' || identity.privileged !== false) fail('DATABASE_IDENTITY');
  const marker = (await client.query('SELECT token FROM m5_guard.environment WHERE singleton = true')).rows;
  if (marker.length !== 1 || marker[0].token !== env.M5_DATABASE_TOKEN) fail('DATABASE_MARKER');
}
function assertDockerEndpoint(info) {
  const endpoint = Array.isArray(info) && info.length === 1 ? info[0]?.Endpoints?.docker?.Host : null;
  if (typeof endpoint !== 'string' || !/^(unix:\/\/\/|npipe:\/\/\/)/.test(endpoint)) fail('REMOTE_DOCKER');
}
function assertComposeConfig(config, root) {
  if (config.name !== PROJECT || JSON.stringify(Object.keys(config.services ?? {}).sort()) !== JSON.stringify(Object.keys(IMAGES).sort())
    || !config.networks?.isolated?.internal || config.networks.isolated.external) fail('COMPOSE_SCOPE');
  for (const [name, image] of Object.entries(IMAGES)) {
    const service = config.services[name];
    if (service.image !== image || service.build || service.privileged || service.network_mode || service.devices
      || service.cap_add || service.env_file || service.container_name) fail('COMPOSE_SCOPE');
    if (JSON.stringify(Object.keys(service.networks ?? {}).sort()) !== '["isolated"]') fail('COMPOSE_SCOPE');
    const actual = service.ports ?? [];
    if (actual.length !== Object.keys(PORTS[name]).length || actual.some(port => port.host_ip !== '127.0.0.1'
      || PORTS[name][`${port.target}/${port.protocol ?? 'tcp'}`] !== String(port.published))) fail('COMPOSE_PORTS');
    for (const mount of service.volumes ?? []) {
      if (mount.type === 'bind') {
        if (name !== 'postgres' || resolve(mount.source) !== resolve(root, 'docker/m5/postgres-init.sql') || !mount.read_only) fail('COMPOSE_MOUNT');
      } else if (mount.type !== 'volume' || !['pg_data', 'redis_data', 'mongo_data'].includes(mount.source)) fail('COMPOSE_MOUNT');
    }
  }
  for (const [name, volume] of Object.entries(config.volumes ?? {})) {
    if (!['pg_data', 'redis_data', 'mongo_data'].includes(name) || volume.external || volume.name !== `${PROJECT}_${name}`) fail('COMPOSE_MOUNT');
  }
}
function assertOwnedContainers(containers) {
  if (!Array.isArray(containers) || containers.length !== Object.keys(IMAGES).length) fail('STACK_NOT_RUNNING');
  const seen = new Set();
  for (const container of containers) {
    const labels = container.Config?.Labels ?? {};
    const service = labels['com.docker.compose.service'];
    if (labels['com.docker.compose.project'] !== PROJECT || !IMAGES[service] || seen.has(service)
      || container.Config.Image !== IMAGES[service] || container.State?.Running !== true) fail('STACK_NOT_RUNNING');
    const bindings = container.HostConfig?.PortBindings ?? {};
    if (JSON.stringify(Object.keys(bindings).sort()) !== JSON.stringify(Object.keys(PORTS[service]).sort())
      || Object.entries(bindings).some(([target, ports]) => !Array.isArray(ports) || ports.length !== 1
        || ports[0].HostIp !== '127.0.0.1' || ports[0].HostPort !== PORTS[service][target])) fail('COMPOSE_PORTS');
    seen.add(service);
  }
}
module.exports = { PROJECT, BEFORE_M4, DATABASES, SCENARIO_DATABASE, GATES, parseEnv, assertRuntime, assertEnvironment, generateEnvironment,
  localUrl, cleanChildEnvironment, migrationManifest, assertDatabaseIdentity, IMAGES, PORTS, assertDockerEndpoint, assertComposeConfig, assertOwnedContainers };
