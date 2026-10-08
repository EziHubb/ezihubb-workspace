import { expect, Page, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test.setTimeout(120_000);
async function fixture(page: Page) {
  const user = { id: 'checkout-fixture', sub: 'checkout-fixture', email: 'buyer@example.test', firstName: 'Fixture', lastName: 'Buyer', role: 'CUSTOMER', accessToken: 'synthetic-access-not-real' };
  const token = await encode({ secret: 'playwright-local-only-not-a-production-secret', token: user });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1') return route.continue();
    if (host === 'api.ezihubb.test') return route.fulfill({ json: { success: true, data: [], meta: {} } });
    return route.abort(); // No provider, production API or third-party network.
  });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user, expires: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/v1/users/me', route => route.fulfill({ json: { success: true, data: user, meta: {} } }));
  await page.route('**/api/v1/orders/checkout-capabilities', route => route.fulfill({ json: { success: true, data: {
    version: 'checkout-v1', onlinePaymentsAvailable: true, orderRequestsAvailable: false,
  }, meta: {} } }));
  await page.route('**/api/v1/cart', route => route.fulfill({ json: { success: true, data: {
    id: 'cart-fixture', items: [{ id: 'item', productId: 'product', productType: 'DIGITAL',
      product: { name: 'Synthetic download', slug: 'fixture', images: [] }, quantity: 1,
      unitPrice: 10, currentPrice: 10, totalPrice: 10 }], discountAmount: 0, subtotal: 10, itemCount: 1,
    totals: { subtotal: 10, discount: 0, shipping: 0, total: 10, itemCount: 1 },
  }, meta: {} } }));
  await page.route('**/api/v1/payments/checkout/order-fixture', route => route.fulfill({ json: { success: true, data: {
    orderId: 'order-fixture', orderNumber: 'EZH-TEST', currency: 'USD', amountMinor: '1000', minorExponent: 2,
    total: 10, status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', canContinue: true, boundProvider: null,
    items: [{ id: 'original-line', productName: 'Frozen original download', variantName: null, quantity: 1 }],
  }, meta: {} } }));
}

test('unbound checkout offers PayPal without first creating Stripe; timeout keeps method locked', async ({ page }) => {
  await fixture(page);
  let orders = 0, stripe = 0, paypal = 0;
  const providerScripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script' && /(?:stripe\.com|paypal\.com)/.test(new URL(request.url()).hostname)) providerScripts.push(request.url());
  });
  await page.route('**/api/v1/orders', route => {
    orders++;
    return route.fulfill({ json: { success: true, data: { orderId: 'order-fixture', orderNumber: 'EZH-TEST',
      total: 10, paymentRequired: true, clientSecret: null, status: 'PENDING_PAYMENT' }, meta: {} } });
  });
  await page.route('**/api/v1/payments/create-intent', route => { stripe++; return route.abort(); });
  await page.route('**/api/v1/payments/paypal/create-order', route => {
    paypal++;
    expect(route.request().postDataJSON()).toEqual({ orderId: 'order-fixture' });
    return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic timeout: same operation needs reconciliation' } } });
  });
  await page.goto('/en/checkout');
  await page.getByRole('button', { name: 'Submit order request', exact: true }).click();
  const card = page.getByRole('radio', { name: 'Credit / Debit Card' });
  const paypalChoice = page.getByRole('radio', { name: 'PayPal', exact: true });
  await expect(paypalChoice).toBeVisible();
  expect(stripe).toBe(0); expect(paypal).toBe(0); expect(orders).toBe(1);
  expect(providerScripts).toEqual([]);
  await paypalChoice.check();
  await page.getByRole('button', { name: 'Continue with selected method' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic timeout' })).toBeVisible();
  await expect(card).toBeDisabled(); await expect(paypalChoice).toBeChecked();
  await page.getByRole('button', { name: 'Continue with selected method' }).click();
  await expect.poll(() => paypal).toBe(2);
  expect(stripe).toBe(0); expect(orders).toBe(1);
  expect(providerScripts).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.getItem('economic-payment-method:order-fixture'))).toBe('paypal');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('manual order request never opens payment controls or calls payment endpoints', async ({ page }) => {
  await fixture(page);
  let paymentRequests = 0;
  await page.route('**/api/v1/payments/**', route => { paymentRequests++; return route.abort(); });
  await page.route('**/api/v1/orders', route => route.fulfill({ json: { success: true, data: {
    orderId: 'manual-fixture', orderNumber: 'EZH-MANUAL', total: 10, paymentRequired: false, clientSecret: null, status: 'CONFIRMED',
  }, meta: {} } }));
  await page.goto('/en/checkout');
  await page.getByRole('button', { name: 'Submit order request', exact: true }).click();
  await expect(page).toHaveURL(/checkout\/success\?order=EZH-MANUAL.*mode=request/);
  expect(paymentRequests).toBe(0);
  await expect(page.getByRole('radio', { name: 'PayPal', exact: true })).toHaveCount(0);
});

test('manual checkout works with blocked browser storage and only saves an opaque identity in a session cookie', async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) Object.defineProperty(Storage.prototype, method,
      { value: () => { throw new Error('Synthetic blocked storage'); } });
  });
  await page.route('**/api/v1/orders/checkout-capabilities', route => route.fulfill({ json: { success: true, data: {
    version: 'checkout-v1', onlinePaymentsAvailable: false, orderRequestsAvailable: true,
  }, meta: {} } }));
  let orders = 0;
  await page.route('**/api/v1/orders', route => {
    orders++;
    expect(route.request().postDataJSON().idempotencyKey).toMatch(/^[A-Za-z0-9_-]{12,80}$/);
    return route.fulfill({ json: { success: true, data: { orderId: 'manual-fixture', orderNumber: 'EZH-MANUAL',
      total: 10, paymentRequired: false, clientSecret: null, status: 'CONFIRMED' }, meta: {} } });
  });
  await page.goto('/en/checkout');
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  expect((await page.context().cookies()).find(cookie => cookie.name === 'cookie_consent_fallback')?.value).toBe('rejected');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit order request', exact: true }).click();
  await expect(page).toHaveURL(/checkout\/success\?order=EZH-MANUAL.*mode=request/);
  expect(orders).toBe(1);
  expect((await page.context().cookies()).find(cookie => cookie.name === 'economic-checkout-request')).toBeUndefined();
});

test('lost creation response recovers the same request before reload with an empty cart', async ({ page }) => {
  await fixture(page);
  let orders = 0, key = '', committed = false;
  await page.route('**/api/v1/orders', route => {
    orders++; key = route.request().postDataJSON().idempotencyKey; committed = true;
    return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic lost response' } } });
  });
  await page.route('**/api/v1/orders/checkout-requests/*', route => {
    expect(new URL(route.request().url()).pathname.endsWith(key)).toBe(true);
    return route.fulfill({ json: { success: true, data: { orderId: 'order-fixture', orderNumber: 'EZH-TEST',
      total: 10, paymentRequired: true, clientSecret: null, status: 'PENDING_PAYMENT' }, meta: {} } });
  });
  await page.route('**/api/v1/cart', route => route.fulfill({ json: { success: true, data: committed
    ? { items: [], itemCount: 0 } : { id: 'cart', items: [{ id: 'item', productType: 'DIGITAL', quantity: 1, currentPrice: 10 }], totals: { subtotal: 10 }, itemCount: 1 }, meta: {} } }));
  await page.goto('/en/checkout');
  await page.getByRole('button', { name: 'Submit order request', exact: true }).click();
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('economic-checkout-request'))).toBe(key);
  expect(key).toMatch(/^[A-Za-z0-9_-]{12,80}$/);
  await page.reload();
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  expect(orders).toBe(1);
});

test('unknown creation outcome permits only explicit replay with the identical key and body', async ({ page }) => {
  await fixture(page);
  const bodies: unknown[] = [];
  await page.route('**/api/v1/orders', route => {
    bodies.push(route.request().postDataJSON());
    return bodies.length === 1 ? route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic timeout' } } })
      : route.fulfill({ json: { success: true, data: { orderId: 'order-fixture', orderNumber: 'EZH-TEST', total: 10,
        paymentRequired: true, clientSecret: null, status: 'PENDING_PAYMENT' }, meta: {} } });
  });
  await page.route('**/api/v1/orders/checkout-requests/*', route => route.fulfill({ status: 404,
    json: { success: false, error: { message: 'Original request not recorded yet' } } }));
  await page.goto('/en/checkout');
  await page.getByRole('button', { name: 'Submit order request', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Original request not recorded yet' })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Submit order request', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry the same order request' }).click();
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
});

test('disabled online checkout retains original order read-only without mounting payment controls', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/v1/orders/checkout-capabilities', route => route.fulfill({ json: { success: true, data: {
    version: 'checkout-v1', onlinePaymentsAvailable: false, orderRequestsAvailable: true,
  }, meta: {} } }));
  await page.goto('/en/checkout');
  await page.evaluate(() => sessionStorage.setItem('economic-pending-checkout', 'order-fixture'));
  await page.reload();
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Online payments are currently unavailable' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
});

test('full reload restores server-frozen checkout with an empty cart and server-bound PayPal', async ({ page }) => {
  await fixture(page);
  let orders = 0, providers = 0, recoveries = 0;
  await page.route('**/api/v1/orders', route => { orders++; return route.abort(); });
  await page.route('**/api/v1/payments/create-intent', route => { providers++; return route.abort(); });
  await page.route('**/api/v1/payments/paypal/**', route => { providers++; return route.abort(); });
  await page.route('**/api/v1/cart', route => route.fulfill({ json: { success: true, data: { items: [], itemCount: 0 }, meta: {} } }));
  await page.route('**/api/v1/payments/checkout/order-fixture', route => {
    recoveries++;
    return route.fulfill({ json: { success: true, data: {
      orderId: 'order-fixture', orderNumber: 'EZH-TEST', currency: 'USD', amountMinor: '1549', minorExponent: 2,
      total: 15.49, status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', canContinue: true, boundProvider: 'PAYPAL',
      items: [{ id: 'original-line', productName: 'Frozen original download', variantName: null, quantity: 2 }],
    }, meta: {} } });
  });
  await page.goto('/en/checkout');
  await page.evaluate(() => sessionStorage.setItem('economic-pending-checkout', 'order-fixture'));
  await page.reload();
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  await expect(page.getByText('$15.49', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'PayPal', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Credit / Debit Card' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Submit order request', exact: true })).toHaveCount(0);
  expect(orders).toBe(0); expect(providers).toBe(0); expect(recoveries).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back to cart', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/cart/);
  expect(await page.evaluate(() => sessionStorage.getItem('economic-pending-checkout'))).toBe('order-fixture');
  await page.goto('/en/checkout');
  await expect(page.getByText('Frozen original download', { exact: true })).toBeVisible();
  expect(orders).toBe(0); expect(providers).toBe(0);
});

test('recovery failure offers retry without silently creating another order or payment', async ({ page }) => {
  await fixture(page);
  let writes = 0;
  await page.route('**/api/v1/orders', route => { writes++; return route.abort(); });
  await page.route('**/api/v1/payments/checkout/order-fixture', route => route.fulfill({ status: 403,
    json: { success: false, error: { message: 'This order belongs to another account' } } }));
  await page.goto('/en/checkout');
  await page.evaluate(() => sessionStorage.setItem('economic-pending-checkout', 'order-fixture'));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'This order belongs to another account' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry order recovery' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This order belongs to another account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit order request', exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
});

test('closed captured order never redirects to checkout success or opens another payment', async ({ page }) => {
  await fixture(page);
  let writes = 0;
  await page.route('**/api/v1/orders', route => { writes++; return route.abort(); });
  await page.route('**/api/v1/payments/checkout/order-fixture', route => route.fulfill({ json: { success: true, data: {
    orderId: 'order-fixture', orderNumber: 'EZH-CLOSED', currency: 'USD', amountMinor: '1000', minorExponent: 2,
    total: 10, status: 'REFUNDED', paymentStatus: 'CLOSED', canContinue: false, boundProvider: 'PAYPAL', items: [],
  }, meta: {} } }));
  await page.goto('/en/checkout');
  await page.evaluate(() => sessionStorage.setItem('economic-pending-checkout', 'order-fixture'));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Order EZH-CLOSED is closed' })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByRole('radio', { name: 'PayPal', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit order request', exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
});
