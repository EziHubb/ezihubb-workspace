import { expect, test, Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { formatCapturedUsd, minorToUsdInput, usdInputToMinor } from '../src/lib/economic-finances';

test('money input and display stay exact beyond floating-point precision', () => {
  expect(usdInputToMinor('12.34')).toBe('1234');
  expect(usdInputToMinor('0.01')).toBe('1');
  expect(usdInputToMinor('90071992547409.93')).toBe('9007199254740993');
  expect(formatCapturedUsd('9007199254740993')).toBe('$90,071,992,547,409.93');
  expect(minorToUsdInput('9007199254740993')).toBe('90071992547409.93');
  for (const invalid of ['0', '-1', '1e3', '1.234', '01.2', 'NaN', '1,000', '92233720368547758.08']) expect(usdInputToMinor(invalid)).toBeNull();
});

async function session(page: Page, role = 'ADMIN') {
  const token = await encode({ secret: 'admin-e2e-local-synthetic-secret', token: {
    id: 'synthetic-owner', sub: 'synthetic-owner', name: 'Synthetic Owner', email: 'owner@example.test',
    role, storeId: 'synthetic-store', accessToken: 'synthetic-token-not-real',
  } });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'api.ezihubb.test') return route.fulfill({ json: { success: true, data: {}, meta: {} } });
    return route.abort();
  });
  await page.route('**/api/v1/users/me', route => route.fulfill({ json: { success: true, data: { id: 'synthetic-owner', role, storeId: 'synthetic-store' }, meta: {} } }));
  // Browser session transport is synthetic; server route authorization still
  // consumes the locally signed test JWT above. No real auth/API is contacted.
  await page.route('**/api/auth/session', route => route.fulfill({ json: { expires: '2099-01-01T00:00:00Z', user: {
    id: 'synthetic-owner', name: 'Synthetic Owner', email: 'owner@example.test', role, storeId: 'synthetic-store', accessToken: 'synthetic-token-not-real',
  } } }));
}
const overview = { version: 'economic-v1', currency: 'USD', minorExponent: 2, beneficiaryId: 'synthetic-store',
  capturedMinor: '10000', availableMinor: '5000', pendingMinor: '1000', heldMinor: '1000', reservedMinor: '1000', paidMinor: '2000', debtMinor: '0',
  minimumPayoutMinor: '1', payoutRequestsEnabled: true };
const history = { data: [], total: 0, page: 1, limit: 20 };

test('seller retries the same payout key after error and reload, with exact money and confirmation', async ({ page }) => {
  await session(page);
  const requests: Array<{ amountMinor: string; idempotencyKey: string }> = [];
  await page.route('**/api/v1/admin/finances/economic/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: requests.length === 1 ? 503 : 201, json: requests.length === 1
        ? { success: false, error: { message: 'Ambiguous synthetic timeout' } }
        : { success: true, data: { id: 'payout-fixture', state: 'REQUESTED', amountMinor: '1234' }, meta: {} } });
    }
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview') ? overview : history, meta: {} } });
  });
  await page.goto('/finances');
  await expect(page.getByRole('heading', { name: 'Payment account', exact: true })).toBeVisible();
  await page.getByLabel('Amount (USD)').fill('12.34');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('payout-confirmation.png') });
  expect(requests).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Amount (USD)')).toHaveValue('12.34');
  await expect(page.getByLabel('Amount (USD)')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Retry same request' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Payout request recorded.', { exact: false })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].amountMinor).toBe('1234');
  expect(requests[1]).toEqual(requests[0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#admin-main-content').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: test.info().outputPath('payment-account.png'), fullPage: true });
});

test('mode switching does not retain live balances and loading errors are not fake zero funds', async ({ page }) => {
  await session(page);
  await page.route('**/api/v1/admin/finances/economic/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('provenance') === 'TEST') return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic offline' } } });
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview') ? { ...overview, availableMinor: '9007199254740993' } : history, meta: {} } });
  });
  await page.goto('/finances');
  await expect(page.getByText('$90,071,992,547,409.93', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Environment', exact: true }).selectOption('TEST');
  await expect(page.getByText('TEST — sandbox funds only', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText('$90,071,992,547,409.93', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Amount (USD)')).toHaveCount(0);
});

test('platform verification binds reference and offers no rejection or new reference after ambiguity', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let state = 'REQUESTED'; let reference: string | null = null;
  const lookups: unknown[] = [];
  await page.route('**/api/v1/admin/economic-finances/**', async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('beneficiaryId')).toBe('synthetic-store');
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); lookups.push(body); reference = body.reference; state = 'VERIFYING';
      return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic provider timeout' } } });
    }
    const row = { id: 'payout-fixture', state, amountMinor: '1234', createdAt: '2026-10-04T00:00:00Z', transferReference: reference,
      processedAt: null, processedBy: null, rejectionReason: null, verificationStartedAt: null, verificationStartedBy: null,
      allocations: [{ lotId: 'lot-a', captureId: 'capture-a', sourceKey: 'line-a', amountMinor: '1234' }] };
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview') ? overview
      : url.pathname.endsWith('/payouts') ? { ...history, data: [row], total: 1 } : history, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByLabel('Store ID', { exact: true }).fill('synthetic-store');
  await page.getByRole('button', { name: 'View verified account' }).click();
  await page.getByRole('button', { name: 'Verify settlement', exact: true }).click();
  await page.getByLabel('Transfer reference', { exact: true }).fill('tr_synthetic');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reject request', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry verification', exact: true }).click();
  await expect(page.getByLabel('Transfer reference', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Transfer reference', { exact: true })).toHaveValue('tr_synthetic');
  expect(lookups).toEqual([{ reference: 'tr_synthetic' }]);
});
