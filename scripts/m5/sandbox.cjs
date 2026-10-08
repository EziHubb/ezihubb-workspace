const { request } = require('node:https');
const { parseEnv } = require('./guard.cjs');
const KEYS = ['M5_SANDBOX_SCOPE', 'M5_STAGE_ORIGIN', 'STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_ID',
  'STRIPE_WEBHOOK_SECRET', 'PAYPAL_MODE', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'];
function assertSandboxRuntimeEnvironment(env = process.env) {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || env.NODE_EXTRA_CA_CERTS || env.NODE_OPTIONS) throw new Error('M5_AMBIENT_TLS_OR_STARTUP_OVERRIDE');
}
function assertSandboxManifest(source) {
  const env = typeof source === 'string' ? parseEnv(source) : source;
  if (Object.keys(env).length !== KEYS.length || Object.keys(env).some(key => !KEYS.includes(key))
    || KEYS.some(key => typeof env[key] !== 'string' || !env[key])) throw new Error('M5_SANDBOX_MANIFEST');
  if (env.M5_SANDBOX_SCOPE !== 'M5_READ_ONLY_SANDBOX_BINDINGS' || env.PAYPAL_MODE !== 'sandbox'
    || !/^sk_test_[A-Za-z0-9]{16,}$/.test(env.STRIPE_SECRET_KEY)
    || !/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID)
    || !/^we_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_ID)
    || !/^whsec_[A-Za-z0-9]{16,}$/.test(env.STRIPE_WEBHOOK_SECRET)
    || !/^[A-Za-z0-9_-]{16,}$/.test(env.PAYPAL_CLIENT_ID)
    || !/^[A-Za-z0-9_-]{16,}$/.test(env.PAYPAL_CLIENT_SECRET)
    || !/^[A-Za-z0-9-]+$/.test(env.PAYPAL_WEBHOOK_ID)) throw new Error('M5_SANDBOX_MODE');
  let origin;
  try { origin = new URL(env.M5_STAGE_ORIGIN); } catch { throw new Error('M5_SANDBOX_ORIGIN'); }
  // Dedicated publicly reachable M5 hostname, never an ordinary/live API host.
  if (origin.protocol !== 'https:' || !/^m5[.-][a-z0-9.-]+\.[a-z]{2,}$/.test(origin.hostname)
    || origin.port || origin.username || origin.password || origin.search || origin.hash
    || origin.pathname !== '/' || origin.origin !== env.M5_STAGE_ORIGIN
    || /(?:^|\.)(?:localhost|local|test|invalid)$/.test(origin.hostname)) throw new Error('M5_SANDBOX_ORIGIN');
  return env;
}
function assertStripeBinding(account, endpoint, env) {
  if (account?.id !== env.STRIPE_ACCOUNT_ID || endpoint?.id !== env.STRIPE_WEBHOOK_ID
    || endpoint.livemode !== false || endpoint.status !== 'enabled'
    || endpoint.url !== `${env.M5_STAGE_ORIGIN}/api/v1/webhooks/stripe`
    || !Array.isArray(endpoint.enabled_events)
    || !['payment_intent.succeeded', 'charge.refunded'].every(name => endpoint.enabled_events.includes('*') || endpoint.enabled_events.includes(name))) {
    throw new Error('M5_STRIPE_SANDBOX_BINDING');
  }
}
function assertPaypalBinding(endpoint, env) {
  if (endpoint?.id !== env.PAYPAL_WEBHOOK_ID || endpoint.url !== `${env.M5_STAGE_ORIGIN}/api/v1/webhooks/paypal`
    || !Array.isArray(endpoint.event_types)
    || !['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.REFUNDED'].every(name => endpoint.event_types.some(event => event.name === name || event.name === '*'))) {
    throw new Error('M5_PAYPAL_SANDBOX_BINDING');
  }
}
// Only official fixed origins/paths. Native HTTPS: no ambient HTTP proxy, redirects,
// cert_url download, custom CA, NODE_TLS_REJECT_UNAUTHORIZED or raw error logging.
function providerJson(host, path, headers, body) {
  assertSandboxRuntimeEnvironment();
  if (!((host === 'api.stripe.com' && /^\/v1\/(account|webhook_endpoints\/we_[A-Za-z0-9]+)$/.test(path))
    || (host === 'api-m.sandbox.paypal.com' && /^\/v1\/(oauth2\/token|notifications\/webhooks\/[A-Za-z0-9-]+)$/.test(path)))) {
    throw new Error('M5_PROVIDER_ENDPOINT');
  }
  if (body !== undefined && !(host === 'api-m.sandbox.paypal.com' && path === '/v1/oauth2/token' && body === 'grant_type=client_credentials')) {
    throw new Error('M5_PROVIDER_METHOD');
  }
  return new Promise((resolve, reject) => {
    const req = request({ hostname: host, port: 443, path, method: body ? 'POST' : 'GET',
      rejectUnauthorized: true, minVersion: 'TLSv1.2', agent: false, signal: AbortSignal.timeout(15_000), headers: { ...headers, Connection: 'close' } }, response => {
      let length = 0; const chunks = [];
      response.on('data', chunk => {
        length += chunk.length;
        if (length > 1024 * 1024) req.destroy(new Error('M5_PROVIDER_RESPONSE_LIMIT'));
        else chunks.push(chunk);
      });
      response.on('error', () => reject(new Error('M5_PROVIDER_READ_FAILED')));
      response.on('end', () => {
        if (response.statusCode !== 200) { reject(new Error('M5_PROVIDER_READ_FAILED')); return; }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error('M5_PROVIDER_READ_FAILED')); }
      });
    });
    req.on('error', () => reject(new Error('M5_PROVIDER_READ_FAILED')));
    req.setTimeout(10_000, () => req.destroy(new Error('M5_PROVIDER_TIMEOUT'))); req.end(body);
  });
}
async function probeBindings(env, read = providerJson) {
  assertSandboxManifest(env);
  const stripeHeaders = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const account = await read('api.stripe.com', '/v1/account', stripeHeaders);
  const endpoint = await read('api.stripe.com', `/v1/webhook_endpoints/${env.STRIPE_WEBHOOK_ID}`, stripeHeaders);
  assertStripeBinding(account, endpoint, env);
  const oauth = await read('api-m.sandbox.paypal.com', '/v1/oauth2/token', {
    Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }, 'grant_type=client_credentials');
  if (typeof oauth?.access_token !== 'string' || !oauth.access_token || oauth.token_type?.toLowerCase() !== 'bearer') throw new Error('M5_PAYPAL_SANDBOX_BINDING');
  const paypal = await read('api-m.sandbox.paypal.com', `/v1/notifications/webhooks/${env.PAYPAL_WEBHOOK_ID}`, { Authorization: `Bearer ${oauth.access_token}` });
  assertPaypalBinding(paypal, env);
  // Binding reads prove configuration only, never capture/refund/delivery proof.
  return { stripeBinding: 'PASS', paypalBinding: 'PASS', financialOperations: false,
    webhookDeliveryVerified: false, signingSecretVerified: false, paypalMerchantVerified: false, sandboxVerified: false };
}
module.exports = { assertSandboxManifest, assertSandboxRuntimeEnvironment, assertStripeBinding, assertPaypalBinding, providerJson, probeBindings };
