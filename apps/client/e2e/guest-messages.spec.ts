import { expect, test } from '@playwright/test';

test('guest inbox verifies email, recovers from invalid code, opens threads and revokes access', async ({ page }) => {
  test.setTimeout(120_000);
  const email = 'guest@example.test';
  let verified = false;
  let verificationAttempts = 0;
  let refreshes = 0;
  let revocations = 0;
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.route('https://api.ezihubb.test/**', (route) => route.fulfill({ json: { success: true, data: [], meta: {} } }));
  await page.route('**/api/v1/auth/refresh', async (route) => {
    refreshes++; await route.fulfill({ status: 401, json: {} });
  });
  await page.route('**/api/v1/messages/guest-access', async (route) => {
    if (route.request().method() === 'DELETE') { verified = false; revocations++; }
    await route.fulfill({ json: { success: true, data: { email: verified ? email : null }, meta: {} } });
  });
  await page.route('**/api/v1/messages/guest-access/request', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email });
    await route.fulfill({ json: { success: true, data: { challengeId: 'proof1234567', expiresIn: 900 }, meta: {} } });
  });
  await page.route('**/api/v1/messages/guest-access/verify', async (route) => {
    verificationAttempts++;
    if (route.request().postDataJSON().code !== '12345678') {
      await route.fulfill({ status: 401, json: { success: false, error: { code: 'ERR_GUEST_PROOF_INVALID', message: 'Invalid code' } } });
      return;
    }
    verified = true;
    await route.fulfill({ json: { success: true, data: { email }, meta: {} } });
  });
  await page.route('**/api/v1/messages/guest-conversations', async (route) => {
    expect(verified).toBe(true);
    await route.fulfill({ json: { success: true, data: [{ id: 'thread123456', store: { name: 'Test Shop' }, lastMessage: 'Your custom design is ready' }], meta: {} } });
  });
  await page.route('**/api/v1/messages/conversations/thread123456', async (route) => {
    expect(verified).toBe(true);
    await route.fulfill({ json: { success: true, data: {
      id: 'thread123456', status: 'OPEN', unreadByCustomer: 0, hasMoreMessages: false,
      store: { name: 'Test Shop', slug: 'test-shop' },
      messages: [{ id: 'message12345', senderType: 'ADMIN', body: 'Your custom design is ready', createdAt: '2026-10-02T12:00:00.000Z', attachmentUrls: [] }],
    }, meta: {} } });
  });

  await page.goto('/en/messages/guest');
  await expect(page.getByRole('heading', { name: 'Guest message inbox' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = page.getByLabel('Email verification code');
  await expect(code).toBeFocused();
  await code.fill('00000000');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.locator('fieldset').getByRole('alert')).toContainText('Invalid or expired code');
  await expect(code).toBeFocused();
  expect(refreshes).toBe(0);
  await code.fill('12345678');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByRole('button', { name: 'Test Shop Your custom design is ready' }).click();
  await expect(page.getByText('Your custom design is ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to inbox', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Test Shop Your custom design is ready' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'End guest session' }).click();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test Shop Your custom design is ready' })).toHaveCount(0);
  expect(verificationAttempts).toBe(2);
  expect(revocations).toBe(1);
  expect(page.url()).not.toContain(email);
  expect(page.url()).not.toContain('12345678');
});
