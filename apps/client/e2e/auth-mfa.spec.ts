import { expect, test } from '@playwright/test';
import { authOptions } from '../src/lib/auth.options';

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.route('https://api.ezihubb.test/**', (route) => route.fulfill({ json: { success: true, data: [], meta: {} } }));
});

test('password challenge is not a session; invalid codes stay editable and can be cancelled', async ({ page }) => {
  test.setTimeout(120_000);
  let refreshes = 0;
  await page.route('**/api/v1/auth/refresh', async (route) => { refreshes++; await route.fulfill({ status: 401, json: {} }); });
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 202,
    json: { success: true, data: { requiresTOTP: true, partialToken: 'test-challenge' }, meta: null } }));
  await page.route('**/api/v1/auth/totp/verify', (route) => route.fulfill({ status: 401,
    json: { success: false, error: { code: 'ERR_TOTP_CODE_INVALID', message: 'Invalid code' } } }));
  await page.goto('/en/login');
  await page.locator('input[name="email"]').fill('buyer@example.test');
  await page.locator('input[name="password"]').fill('test-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  expect(page.url()).not.toContain('test-challenge');
  await page.getByLabel('Authentication code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('That code is not valid');
  await expect(page.getByLabel('Authentication code', { exact: true })).toBeFocused();
  expect(refreshes).toBe(0); // No credential retries through refresh middleware.
  await page.getByRole('button', { name: 'Back to sign-in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('OAuth callback removes challenge from URL and does not repeat a consumed code after session failure', async ({ page }) => {
  test.setTimeout(120_000);
  let verifications = 0;
  let bridges = 0;
  await page.route('**/api/v1/auth/totp/verify', async (route) => {
    verifications++;
    await route.fulfill({ json: { success: true, data: { accessToken: 'test-access', user: { id: 'u', email: 'buyer@example.test' } }, meta: {} } });
  });
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { csrfToken: 'test-csrf' } }));
  await page.route('**/api/auth/providers', (route) => route.fulfill({ json: { 'google-token': { id: 'google-token', name: 'Google', type: 'credentials', signinUrl: '', callbackUrl: '' } } }));
  await page.route('**/api/auth/callback/google-token', async (route) => {
    bridges++;
    await route.fulfill({ status: 401, json: { url: 'http://127.0.0.1:3000/en/login?error=CredentialsSignin' } });
  });
  await page.goto('/en/auth/google/callback#partialToken=test-challenge');
  await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  expect(page.url()).not.toContain('partialToken');
  await page.getByLabel('Authentication code', { exact: true }).fill('A1B2C3D4');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Unable to finish signing in');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect.poll(() => bridges).toBe(2);
  expect(verifications).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('session bridge trusts the API identity, never browser user JSON, and fails closed', async () => {
  const providers = authOptions.providers as { options?: {
    id?: string; authorize: (credentials: { accessToken: string; user: string }) => Promise<{ id: string; role?: string } | null>;
  } }[];
  const authorize = providers.find((provider) => provider.options?.id === 'google-token')?.options?.authorize;
  expect(authorize).toBeDefined();
  if (!authorize) throw new Error('Missing token bridge');
  const originalFetch = globalThis.fetch;
  const credentials = { accessToken: 'test-token', user: JSON.stringify({ id: 'forged', role: 'SUPER_ADMIN' }) };
  try {
    globalThis.fetch = async (_url, init) => {
      expect(init?.cache).toBe('no-store');
      expect(init?.headers).toEqual({ Authorization: 'Bearer test-token' });
      return Response.json({ success: true, data: { id: 'actual', role: 'CUSTOMER', email: 'buyer@example.test' } });
    };
    expect(await authorize(credentials)).toMatchObject({ id: 'actual', role: 'CUSTOMER' });
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    expect(await authorize(credentials)).toBeNull();
    globalThis.fetch = async () => { throw new Error('unavailable'); };
    expect(await authorize(credentials)).toBeNull();
  } finally { globalThis.fetch = originalFetch; }
});
