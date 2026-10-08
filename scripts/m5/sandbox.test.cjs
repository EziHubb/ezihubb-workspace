const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertSandboxManifest, assertSandboxRuntimeEnvironment, assertStripeBinding, assertPaypalBinding, probeBindings, providerJson } = require('./sandbox.cjs');
const { createLoopbackCertificate } = require('./tls.cjs');
const { X509Certificate } = require('node:crypto');
const { assertCompletedContentionReport } = require('./evidence.cjs');
function fixture() {
  return { M5_SANDBOX_SCOPE: 'M5_READ_ONLY_SANDBOX_BINDINGS', M5_STAGE_ORIGIN: 'https://m5-api.example.com',
    STRIPE_SECRET_KEY: `sk_test_${'s'.repeat(32)}`, STRIPE_ACCOUNT_ID: 'acct_synthetic', STRIPE_WEBHOOK_ID: 'we_synthetic',
    STRIPE_WEBHOOK_SECRET: `whsec_${'w'.repeat(32)}`, PAYPAL_MODE: 'sandbox', PAYPAL_CLIENT_ID: 'c'.repeat(32),
    PAYPAL_CLIENT_SECRET: 'p'.repeat(32), PAYPAL_WEBHOOK_ID: 'WH-synthetic' };
}
function bindings(env) {
  return { stripe: { id: env.STRIPE_WEBHOOK_ID, livemode: false, status: 'enabled',
    url: `${env.M5_STAGE_ORIGIN}/api/v1/webhooks/stripe`, enabled_events: ['payment_intent.succeeded', 'charge.refunded'] },
  paypal: { id: env.PAYPAL_WEBHOOK_ID, url: `${env.M5_STAGE_ORIGIN}/api/v1/webhooks/paypal`,
    event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }, { name: 'PAYMENT.CAPTURE.REFUNDED' }] } };
}
test('sandbox manifest is separate from foundation and cannot activate app gates', () => {
  const env = fixture(); assertSandboxManifest(env);
  assert.throws(() => assertSandboxManifest({ ...env, ECONOMIC_V1_ENABLED: 'true' }), /M5_SANDBOX_MANIFEST/);
  assert.throws(() => assertSandboxManifest({ ...env, DATABASE_URL: 'postgresql://production' }), /M5_SANDBOX_MANIFEST/);
});
for (const origin of ['https://api.ezihubb.com', 'http://m5-api.example.com', 'https://m5-api.example.com/',
  'https://m5-api.example.com:444', 'https://user:pass@m5-api.example.com', 'https://m5-api.example.com?secret=yes',
  'https://m5-api.ezihubb.test', 'https://127.0.0.1']) test(`rejects unapproved origin shape: ${origin}`, () => {
  assert.throws(() => assertSandboxManifest({ ...fixture(), M5_STAGE_ORIGIN: origin }), /M5_SANDBOX_ORIGIN/);
});
test('rejects LIVE keys, paypal mode, missing credentials and interpolation before network', () => {
  for (const mutation of [{ STRIPE_SECRET_KEY: `sk_live_${'s'.repeat(32)}` }, { PAYPAL_MODE: 'live' },
    { STRIPE_WEBHOOK_SECRET: '' }, { PAYPAL_CLIENT_SECRET: undefined }]) {
    assert.throws(() => assertSandboxManifest({ ...fixture(), ...mutation }), /M5_SANDBOX_/);
  }
  assert.throws(() => assertSandboxManifest('KEY=$SECRET'), /M5_INVALID_ENV_FILE/);
});
test('Stripe binding needs original account, test endpoint, enabled status, exact callback and event coverage', () => {
  const env = fixture(), endpoint = bindings(env).stripe;
  assertStripeBinding({ id: env.STRIPE_ACCOUNT_ID }, endpoint, env);
  assert.throws(() => assertStripeBinding({ id: 'acct_foreign' }, endpoint, env), /M5_STRIPE_SANDBOX_BINDING/);
  for (const change of [{ livemode: true }, { livemode: undefined }, { id: 'we_foreign' }, { status: 'disabled' },
    { url: 'https://api.ezihubb.com/api/v1/webhooks/stripe' }, { enabled_events: ['payment_intent.succeeded'] }]) {
    assert.throws(() => assertStripeBinding({ id: env.STRIPE_ACCOUNT_ID }, { ...endpoint, ...change }, env), /M5_STRIPE_SANDBOX_BINDING/);
  }
});
test('PayPal binding cannot adopt another webhook or missing refund callback', () => {
  const env = fixture(), endpoint = bindings(env).paypal;
  assertPaypalBinding(endpoint, env);
  for (const change of [{ id: 'WH-foreign' }, { url: `${env.M5_STAGE_ORIGIN}/wrong` }, { event_types: [] }]) {
    assert.throws(() => assertPaypalBinding({ ...endpoint, ...change }, env), /M5_PAYPAL_SANDBOX_BINDING/);
  }
});
test('provider path allowlist rejects mutation, live PayPal, arbitrary cert URLs without I/O', () => {
  for (const [host, path] of [['api-m.paypal.com', '/v1/oauth2/token'], ['api.stripe.com', '/v1/refunds'],
    ['attacker.test', '/v1/account'], ['api.stripe.com', '/v1/account?redirect=yes'],
    ['api-m.sandbox.paypal.com', '/v2/checkout/orders']]) {
    assert.throws(() => providerJson(host, path, {}), /M5_PROVIDER_ENDPOINT/);
  }
  assert.throws(() => providerJson('api.stripe.com', '/v1/account', {}, 'change=account'), /M5_PROVIDER_METHOD/);
  assert.throws(() => providerJson('api-m.sandbox.paypal.com', '/v1/notifications/webhooks/WH-synthetic', {}, '{}'), /M5_PROVIDER_METHOD/);
  assert.throws(() => providerJson('api-m.sandbox.paypal.com', '/v1/oauth2/token', {}, 'grant_type=changed'), /M5_PROVIDER_METHOD/);
});
test('rejects ambient TLS trust/bypass and startup injection before provider I/O', () => {
  assertSandboxRuntimeEnvironment({});
  for (const env of [{ NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { NODE_EXTRA_CA_CERTS: 'foreign.pem' }, { NODE_OPTIONS: '--require injected.cjs' }]) {
    assert.throws(() => assertSandboxRuntimeEnvironment(env), /M5_AMBIENT_TLS_OR_STARTUP_OVERRIDE/);
  }
});
test('modeled provider reads never turn into actual callback/merchant/financial acceptance', async () => {
  const env = fixture(), records = bindings(env), calls = [];
  const result = await probeBindings(env, async (host, path, headers, body) => {
    calls.push({ host, path, body }); assert(headers.Authorization);
    if (path === '/v1/account') return { id: env.STRIPE_ACCOUNT_ID };
    if (path.startsWith('/v1/webhook_endpoints/')) return records.stripe;
    if (path === '/v1/oauth2/token') return { access_token: 'synthetic', token_type: 'Bearer' };
    return records.paypal;
  });
  assert.equal(calls.length, 4); assert.equal(calls.filter(call => call.body).length, 1);
  for (const flag of ['financialOperations', 'webhookDeliveryVerified', 'signingSecretVerified', 'paypalMerchantVerified', 'sandboxVerified']) assert.equal(result[flag], false);
  assert(!JSON.stringify(result).includes(env.STRIPE_SECRET_KEY));
});
test('modeled Stripe LIVE response stops before PayPal OAuth', async () => {
  const env = fixture(); let calls = 0;
  await assert.rejects(probeBindings(env, async () => ++calls === 1 ? { id: env.STRIPE_ACCOUNT_ID } : { ...bindings(env).stripe, livemode: true }), /M5_STRIPE_SANDBOX_BINDING/);
  assert.equal(calls, 2);
});
test('ephemeral cert is self-signed, unique, valid only briefly and loopback scoped', () => {
  const first = createLoopbackCertificate(), second = createLoopbackCertificate();
  const cert = new X509Certificate(first.cert);
  assert.notEqual(first.cert, second.cert); assert.notEqual(first.key, second.key);
  assert(cert.verify(cert.publicKey)); assert(cert.checkIP('127.0.0.1')); assert(cert.checkHost('localhost'));
  assert.equal(cert.checkHost('api.ezihubb.com'), undefined);
  assert(Date.parse(cert.validTo) - Date.parse(cert.validFrom) <= 3_700_000);
});
test('sandbox preflight cannot advance from stale, partial or differently bound contention evidence', () => {
  const sourceChecksums = { source: 'a'.repeat(64) }, migrations = [{ name: 'migration', checksum: 'b'.repeat(64) }];
  const foundationId = 'f'.repeat(24);
  const report = { version: 'm5.2-v1', action: 'contention', outcome: 'PASS', contentionVerified: true,
    productionActivated: false, providerOperations: false, scope: 'LOCAL_SYNTHETIC_CONTENTION_ONLY',
    foundationRunId: foundationId, runId: 'c'.repeat(24), sourceChecksums, migrations,
    steps: [{ name: 'native-prisma-multi-session-business-invariants', outcome: 'PASS' }],
    cases: require('./scenario-contract.json').map(name => ({ name, outcome: 'PASS', assertions: 'EXACT_DB_STATE', backendPids: [101, 102] })) };
  assert.equal(assertCompletedContentionReport(report, sourceChecksums, migrations, foundationId), report.runId);
  for (const change of [{ contentionVerified: false }, { foundationRunId: 'd'.repeat(24) }, { outcome: 'BLOCKED' },
    { sourceChecksums: {} }, { migrations: [] }, { providerOperations: true }, { cases: report.cases.slice(1) },
    { cases: report.cases.map(row => ({ ...row, backendPids: [101, 101] })) }]) {
    assert.throws(() => assertCompletedContentionReport({ ...report, ...change }, sourceChecksums, migrations, foundationId), /M5_CONTENTION_/);
  }
});
