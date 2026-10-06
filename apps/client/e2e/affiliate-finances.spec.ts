import { expect, test, Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test.setTimeout(120_000);
const balance = { availableMinor: '10000', pendingMinor: '1234', heldMinor: '0', reservedMinor: '0', paidMinor: '900', debtMinor: '0', minimumPayoutMinor: '7525', payoutRequestsEnabled: true };
async function fixture(page: Page) {
  const user = { id: 'fixture-affiliate-user', sub: 'fixture-affiliate-user', email: 'affiliate@example.test', firstName: 'Fixture', lastName: 'Affiliate', role: 'CUSTOMER', accessToken: 'synthetic-access-not-real' };
  const token = await encode({ secret: 'playwright-local-only-not-a-production-secret', token: user });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1') return route.continue();
    if (host === 'api.ezihubb.test') return route.fulfill({ json: { success: true, data: [], meta: {} } });
    return route.abort();
  });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user, expires: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/v1/users/me', route => route.fulfill({ json: { success: true, data: user, meta: {} } }));
  await page.route('**/api/v1/affiliates/me', route => route.fulfill({ json: { success: true, data: { id: 'fixture-affiliate', status: 'ACTIVE', balance: 999999, firstName: 'Fixture', lastName: 'Affiliate', referralCode: 'FIXTURE' }, meta: {} } }));
  await page.route('**/api/v1/affiliates/me/payouts', route => {
    expect(route.request().method()).toBe('GET');
    return route.fulfill({ json: { success: true, data: [{ id: 'legacy-payout', amount: '999.99', status: 'PAID' }], meta: {} } });
  });
}

test('affiliate uses API minimum, confirmation, exact cents and same request after timeout/reload', async ({ page }) => {
  await fixture(page);
  const bodies: unknown[] = [];
  await page.route('**/api/v1/affiliates/me/economic/**', route => {
    if (route.request().method() === 'POST') {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: bodies.length === 1 ? 503 : 201, json: bodies.length === 1
        ? { success: false, error: { message: 'Synthetic timeout' } }
        : { success: true, data: { id: 'payout-fixture', state: 'REQUESTED' }, meta: {} } });
    }
    return route.fulfill({ json: { success: true, data: new URL(route.request().url()).pathname.endsWith('/overview') ? balance : { data: [], total: 0 }, meta: {} } });
  });
  await page.goto('/en/affiliate/payouts');
  await expect(page.getByRole('heading', { name: 'Verified balances & payouts' })).toBeVisible();
  await expect(page.getByText('Minimum $75.25.', { exact: false })).toBeVisible();
  await page.getByLabel('Amount (USD)', { exact: true }).fill('50');
  await expect(page.getByRole('button', { name: 'Review request' })).toBeDisabled();
  await page.getByLabel('Amount (USD)', { exact: true }).fill('75.25');
  const trigger = page.getByRole('button', { name: 'Review request' });
  const confirmation = page.getByRole('dialog', { name: 'Confirm payout request' });
  await trigger.click();
  await expect(confirmation).toBeVisible();
  expect(bodies).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Amount (USD)', { exact: true })).toHaveValue('75.25');
  await expect(page.getByLabel('Amount (USD)', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Retry same request' }).click();
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Request recorded.', { exact: false })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatchObject({ amountMinor: '7525', currency: 'USD', provenance: 'LIVE' });
  expect(bodies[1]).toEqual(bodies[0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Vietnamese mode switching isolates money and never shows a failed fetch as zero', async ({ page }) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/affiliates/me/economic/**', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('provenance') === 'TEST') return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic offline' } } });
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview') ? { ...balance, availableMinor: '9007199254740993' } : { data: [], total: 0 }, meta: {} } });
  });
  await page.goto('/vi/affiliate/payouts');
  await expect(page.getByText('$90,071,992,547,409.93', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Môi trường' }).selectOption('TEST');
  await expect(page.getByText('Không tải được số dư.', { exact: false })).toBeVisible();
  await expect(page.getByText('$90,071,992,547,409.93', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Số tiền (USD)', { exact: true })).toHaveCount(0);
});
