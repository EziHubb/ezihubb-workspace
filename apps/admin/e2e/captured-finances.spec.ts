import { expect, test, Page, Locator } from '@playwright/test';
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
function paginationIndicator(panel: Locator, isMobile: boolean, page: number, total: number) {
  return isMobile ? panel.getByText(`Page ${page} of ${total}`, { exact: true })
    : panel.getByRole('button', { name: `Page ${page}`, exact: true }).and(panel.locator('[aria-current="page"]'));
}

const shopEarnings = { version: 'economic-v1', provenance: 'LIVE', currency: 'USD', minorExponent: 2,
  storeId: 'synthetic-store', storeOrderId: 'shop-order', orderId: 'original-order', captureId: 'original-capture',
  basis: 'IMMUTABLE_VERIFIED_SHOP_ALLOCATION', state: 'CAPTURE_VERIFIED', readOnly: true, legacyIncluded: false,
  actualProviderCostMinor: null, actualShippingCostMinor: null, profitMinor: null,
  taxBasis: 'ORDER_LEVEL_TAX_NOT_ALLOCATED_TO_SHOP', pendingRefundCount: 1,
  amounts: { customerCapturedMinor: '200', customerRefundedMinor: '100', netCustomerCollectedMinor: '100',
    platformFundingMinor: '0', sellerGrossMinor: '200', sellerAllocatedMinor: '180', sellerReversedMinor: '90',
    netSellerAllocationMinor: '90', sellerFeeMinor: '20', reversedFeeMinor: '10', netFeeMinor: '10',
    paidMinor: '0', reservedMinor: '0', debtRecoveredMinor: '0' },
  feeLines: [{ code: 'TRANSACTION_FEE', ruleReference: 'original-policy', capturedMinor: '20', reversedMinor: '10', netMinor: '10' }] };
async function earningsPanel(page: Page, read: () => unknown, failure: () => boolean = () => false) {
  await session(page);
  const shipTo = { name: 'Synthetic Buyer', phone: null, address: null, city: null, state: null, zip: null, country: null };
  const step = { id: 'confirmed', name: 'Confirmed', kind: 'CONFIRMED', sortOrder: 0, orderCount: 1 };
  const row = { id: 'shop-order', orderId: 'original-order', orderNumber: 'EZH-EARNINGS', status: 'CONFIRMED',
    step, shipByDate: null, orderedAt: '2026-10-08T00:00:00Z', total: 2, shippingCost: 0, shippingSubsidy: 0,
    shippingMethod: null, couponCode: null, isGift: false, note: null, upgradeRequested: false,
    buyer: { id: null, name: 'Synthetic Buyer' }, shipTo, items: [] };
  await page.route('**/api/v1/admin/order-progress/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/earnings') && failure()) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic earnings offline' } } });
    const data = path.endsWith('/earnings') ? read() : path.endsWith('/steps') ? [step]
      : path.endsWith('/orders') ? { data: [row], pagination: { page: 1, limit: 24, total: 1, totalPages: 1 }, cancelledCount: 0 }
      : path.endsWith('/destinations') ? [] : path.endsWith('/messages') ? { conversationId: null, messages: [] }
      : { ...row, orderStatus: 'CONFIRMED', shop: { id: 'synthetic-store', name: 'Synthetic Store', slug: 'synthetic' },
        giftMessage: null, buyerNote: null, privateNote: null, itemCount: 0,
        buyer: { ...row.buyer, email: null, avatarUrl: null, isGuest: true }, delivery: { methodName: null, cost: 0, window: null },
        receipt: { itemTotal: 2, discount: 0, couponCode: null, subtotal: 2, postage: 0, shippingSubsidy: 0, total: 2, paidVia: null, paidAt: null } };
    return route.fulfill({ json: { success: true, data, meta: {} } });
  });
  await page.route('**/api/v1/admin/message-snippets**', route => route.fulfill({ json: { success: true, data: [], meta: {} } }));
  return async () => {
    await page.goto('/orders'); await page.getByRole('button', { name: '#EZH-EARNINGS', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Order from Synthetic Buyer', exact: true });
    await modal.getByRole('button', { name: 'Earnings', exact: true }).click(); return modal;
  };
}

test('shop earnings distinguish exact LIVE/TEST evidence, pending refunds and unverified capture', async ({ page }) => {
  let response: unknown = shopEarnings;
  const open = await earningsPanel(page, () => response);
  let modal = await open();
  await expect(modal.getByRole('region', { name: 'Verified shop allocations' })).toContainText('Net seller allocation after refunds $0.90');
  await expect(modal.getByRole('status')).toContainText('awaiting verified settlement');
  await expect(modal).toContainText('not profit or withdrawable cash');
  await modal.screenshot({ path: test.info().outputPath('shop-earnings.png') });
  response = { ...shopEarnings, provenance: 'TEST', amounts: { ...shopEarnings.amounts, customerCapturedMinor: '9007199254741013',
    customerRefundedMinor: '0', netCustomerCollectedMinor: '9007199254741013', sellerGrossMinor: '9007199254741013',
    sellerAllocatedMinor: '9007199254740993', sellerReversedMinor: '0', netSellerAllocationMinor: '9007199254740993',
    reversedFeeMinor: '0', netFeeMinor: '20' }, feeLines: [{ ...shopEarnings.feeLines[0], reversedMinor: '0', netMinor: '20' }] };
  modal = await open(); await expect(modal).toContainText('TEST · Simulation, not live money.');
  await expect(modal).toContainText('$90,071,992,547,409.93');
  expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  response = { ...shopEarnings, state: 'AWAITING_CAPTURE', captureId: null, amounts: null, feeLines: [], pendingRefundCount: 0 };
  modal = await open(); await expect(modal.getByRole('status')).toContainText('No verified capture yet');
  await expect(modal.getByText('Net seller allocation after refunds', { exact: false })).toHaveCount(0);
});

test('shop earnings hide malformed/foreign evidence, report errors and classify historical ledger separately', async ({ page }) => {
  let response: unknown = shopEarnings, offline = false;
  const open = await earningsPanel(page, () => response, () => offline);
  for (const invalid of [{ ...shopEarnings, storeOrderId: 'another-shop' },
    { ...shopEarnings, amounts: { ...shopEarnings.amounts, netSellerAllocationMinor: 90 } },
    { ...shopEarnings, amounts: { ...shopEarnings.amounts, netCustomerCollectedMinor: '999' } },
    { ...shopEarnings, profitMinor: '90' }]) {
    response = invalid; const modal = await open(); await expect(modal.getByRole('alert')).toContainText('could not be verified');
    await expect(modal.getByRole('region', { name: 'Verified shop allocations' })).toHaveCount(0);
  }
  offline = true; let modal = await open(); await expect(modal.getByRole('alert')).toContainText('Could not load earnings');
  offline = false; response = { version: 'legacy-ledger', financeReporting: { classification: 'LEGACY_UNKNOWN',
    versionedFundsIncluded: false, requiresReconciliation: true }, includedInAvailable: false, pending: false,
    youEarned: 1.8, buyerPaid: { total: 2, itemsPrice: 2, postage: 0, shippingSubsidy: 0, discount: 0, couponCode: null, subtotal: 2 },
    fees: { total: -0.2, lines: [{ type: 'TRANSACTION_FEE', label: 'Original fee', amount: -0.2 }] } };
  modal = await open(); await expect(modal).toContainText('LEGACY_UNKNOWN');
  await expect(modal).toContainText('Historical ledger net $1.80');
  await expect(modal.getByText('You earned', { exact: false })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Buyer paid' }).click();
  await expect(modal.getByRole('region', { name: 'Buyer paid', exact: true }).getByText('Order total', { exact: true })).toBeVisible();
});

test('external effects confirm once, recover unknown POD by lookup and never offer email resend', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let state = 'PREPARED'; const posts: { path: string; body: unknown }[] = [];
  await page.route('**/api/v1/admin/economic-finances/external-effects?**', route => {
    const url = new URL(route.request().url()), mode = url.searchParams.get('provenance');
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', provenance: mode, currency: 'USD', page: 1, limit: 20,
      podEnabled: mode === 'LIVE', total: mode === 'LIVE' ? 2 : 0, data: mode === 'LIVE' ? [
        { id: 'pod-effect', orderId: 'original-order', storeOrderId: 'shop-order', kind: 'POD_PRINTIFY', state,
          providerReference: state === 'SUCCEEDED' ? 'original' : null, requestedBy: 'synthetic-owner', reason: 'Verified original shop', resultBasis: 'ORIGINAL_PROVIDER_RESOURCE' },
        { id: 'email-effect', orderId: 'original-order', storeOrderId: null, kind: 'EMAIL_TRANSACTIONAL', state: 'NEEDS_RECONCILIATION',
          providerReference: null, requestedBy: 'system:lifecycle', reason: 'Original receipt', resultBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' },
      ] : [] }, meta: {} } });
  });
  await page.route('**/api/v1/admin/economic-finances/external-effects/pod-effect/execute-pod?**', route => {
    const body = route.request().postDataJSON(); posts.push({ path: new URL(route.request().url()).pathname, body });
    if (!body.reference) { state = 'NEEDS_RECONCILIATION'; return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic provider timeout' } } }); }
    state = 'SUCCEEDED'; return route.fulfill({ json: { success: true, data: { id: 'pod-effect', state, providerReference: 'original' }, meta: {} } });
  });
  await page.goto('/payouts'); await page.getByRole('button', { name: 'Review POD and notifications' }).click();
  const panel = page.getByRole('region', { name: 'POD and notification reconciliation', exact: true });
  const review = panel.getByRole('button', { name: 'Review POD dispatch', exact: true });
  await review.click();
  const confirm = page.getByRole('dialog', { name: 'Confirm one-time POD dispatch', exact: true });
  await page.keyboard.press('Escape'); await expect(review).toBeFocused(); expect(posts).toHaveLength(0);
  await review.click(); await confirm.getByRole('button', { name: 'Confirm original POD action', exact: true }).click();
  await expect(confirm.getByRole('alert')).toContainText('timeout');
  await expect(confirm.getByRole('button', { name: 'Confirm original POD action', exact: true })).toBeDisabled();
  await confirm.getByRole('button', { name: 'Cancel POD action' }).click();
  await panel.getByRole('button', { name: 'Refresh external effects' }).click();
  await panel.getByRole('button', { name: 'Look up original POD outcome' }).click();
  const lookup = page.getByRole('dialog', { name: 'Verify original POD outcome', exact: true });
  await lookup.getByLabel('Original provider order reference').fill('original');
  await lookup.getByRole('button', { name: 'Confirm original POD action', exact: true }).click();
  await expect(lookup.getByRole('status')).toContainText('No duplicate');
  await lookup.getByRole('button', { name: 'Close POD confirmation' }).click();
  expect(posts).toEqual([{ path: '/api/v1/admin/economic-finances/external-effects/pod-effect/execute-pod', body: {} },
    { path: '/api/v1/admin/economic-finances/external-effects/pod-effect/execute-pod', body: { reference: 'original' } }]);
  await expect(panel.getByText('No verified SMTP acceptance.', { exact: false })).toBeVisible();
  await expect(panel.getByRole('button', { name: /resend/i })).toHaveCount(0);
  await panel.getByLabel('External-effect environment').click();
  await page.getByRole('option', { name: 'Test / sandbox (no buyer or POD sends)', exact: true }).click();
  await expect(panel.getByText('No external effects in this environment.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Prepare POD intent', exact: true })).toBeDisabled();
  await expect(panel.getByText('original-order', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('external effects hide malformed/mixed-mode records and remain unavailable to sellers', async ({ page }) => {
  await session(page, 'SUPER_ADMIN'); let malformed = true;
  await page.route('**/api/v1/admin/economic-finances/external-effects?**', route => route.fulfill({ json: { success: true, data: {
    version: 'economic-v1', provenance: malformed ? 'TEST' : 'LIVE', currency: 'USD', page: 1, limit: 20,
    podEnabled: true, total: 1, data: { id: 'not-an-array' },
  }, meta: {} } }));
  await page.goto('/payouts'); await page.getByRole('button', { name: 'Review POD and notifications' }).click();
  const panel = page.getByRole('region', { name: 'POD and notification reconciliation', exact: true });
  await expect(panel.getByRole('alert')).toContainText('could not be verified');
  await expect(panel.getByRole('button', { name: 'Prepare POD intent', exact: true })).toBeDisabled();
  malformed = false; await panel.getByRole('button', { name: 'Refresh external effects' }).click();
  await expect(panel.getByRole('alert')).toContainText('could not be verified');
  await session(page, 'ADMIN'); await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Review POD and notifications' })).toHaveCount(0);
});

test('DEAD lifecycle recovery confirms an audit reason and retries only the same event after an unknown response', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let recovered = false;
  const posts: { path: string; body: unknown }[] = [];
  await page.route('**/api/v1/admin/economic-finances/lifecycle-recovery?**', route => route.fulfill({ json: { success: true, data: {
    version: 'economic-v1', provenance: 'LIVE', currency: 'USD', recoveryEnabled: true, total: 1, page: 1, limit: 20,
    data: [{ id: 'terminal-event', orderId: 'original-order', orderNumber: 'EZH-RECOVERY', eventType: 'capture.verified.v1', state: 'DEAD', attempts: 5,
      recovery: recovered ? { actorId: 'synthetic-owner', reason: 'Original inventory restored', applied: true, createdAt: '2026-10-08T00:00:00Z' } : null }],
  }, meta: {} } }));
  await page.route('**/api/v1/admin/economic-finances/outbox/terminal-event/recover-lifecycle?**', route => {
    posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    if (!recovered) { recovered = true; return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic response lost after commit' } } }); }
    return route.fulfill({ json: { success: true, data: { id: 'audit', applied: true, alreadyRecovered: true }, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review lifecycle recovery records' }).click();
  const panel = page.getByRole('region', { name: 'Lifecycle recovery', exact: true });
  const review = panel.getByRole('button', { name: 'Review lifecycle recovery', exact: true });
  await review.click();
  const modal = page.getByRole('dialog', { name: 'Confirm database lifecycle recovery', exact: true });
  await expect(modal.getByRole('button', { name: 'Confirm lifecycle recovery', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(review).toBeFocused(); expect(posts).toHaveLength(0);
  await review.click();
  await modal.getByLabel('Audit reason (required)').fill('Original inventory restored');
  await modal.getByRole('button', { name: 'Confirm lifecycle recovery', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('response lost');
  await modal.getByRole('button', { name: 'Confirm lifecycle recovery', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('Recovery recorded');
  expect(posts).toEqual([
    { path: '/api/v1/admin/economic-finances/outbox/terminal-event/recover-lifecycle', body: { reason: 'Original inventory restored' } },
    { path: '/api/v1/admin/economic-finances/outbox/terminal-event/recover-lifecycle', body: { reason: 'Original inventory restored' } },
  ]);
  await modal.getByRole('button', { name: 'Close recovery confirmation' }).click();
  await expect(panel.getByRole('heading', { name: 'Lifecycle recovery', exact: true })).toBeFocused();
  await expect(panel.getByText('Missing effects applied.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('verified money totals never merge modes or present unverified costs and query errors as zero', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let failTest = true;
  const methods: string[] = [];
  await page.route('**/api/v1/admin/economic-finances/summary?**', route => {
    methods.push(route.request().method());
    const mode = new URL(route.request().url()).searchParams.get('provenance');
    if (mode === 'TEST' && failTest) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic summary offline' } } });
    return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', provenance: mode, currency: 'USD', minorExponent: 2, readOnly: true,
      basis: 'IMMUTABLE_VERIFIED_EVIDENCE', legacyIncluded: false,
      capturedMinor: mode === 'LIVE' ? '9007199254740993' : '1500', refundedMinor: '100', netCollectedMinor: mode === 'LIVE' ? '9007199254740893' : '1400',
      paidOutMinor: '60', outstandingDebtMinor: '40', recoveredDebtMinor: '20', bookedRefundRoundingMinor: '-1',
      actualProviderFeeMinor: null, actualShippingCostMinor: null,
    }, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review verified money totals' }).click();
  const panel = page.getByRole('region', { name: 'Verified money totals', exact: true });
  await expect(panel.getByText('$90,071,992,547,409.93', { exact: true })).toBeVisible();
  await expect(panel.getByText('Unknown — no verified cost receipt', { exact: true })).toHaveCount(2);
  const environment = panel.getByRole('combobox', { name: 'Money environment' });
  await environment.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const activeOption = page.getByRole('option', { name: 'Test / sandbox', exact: true });
  await expect(environment).toHaveAttribute('aria-activedescendant', await activeOption.getAttribute('id') ?? 'missing-option-id');
  await expect(environment).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(environment).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.getByText('$90,071,992,547,409.93', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByText('$90,071,992,547,409.93', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('$0.00', { exact: true })).toHaveCount(0);
  failTest = false;
  await panel.getByRole('button', { name: 'Retry verified totals' }).click();
  await expect(panel.getByText('$15.00', { exact: true })).toBeVisible();
  expect(methods.every(method => method === 'GET')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('platform reconciliation keeps unknown outcomes explicit, separates modes and paginates without writes', async ({ page, isMobile }) => {
  await session(page, 'SUPER_ADMIN');
  let failTest = true;
  const requests: URL[] = [];
  const writes: string[] = [];
  await page.route('**/api/v1/admin/economic-finances/reconciliation?**', async route => {
    const request = route.request(), url = new URL(request.url()); requests.push(url);
    if (request.method() !== 'GET') writes.push(request.method());
    const mode = url.searchParams.get('provenance');
    if (mode === 'TEST' && failTest) return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic offline' } } });
    const pageNumber = Number(url.searchParams.get('page'));
    const row = { id: 'operation-fixture', orderId: 'order-fixture', orderNumber: mode === 'LIVE' ? 'EZH-LIVE' : 'EZH-TEST',
      kind: url.searchParams.get('kind') ?? 'CAPTURE', state: url.searchParams.get('state') ?? 'NEEDS_RECONCILIATION', provider: 'STRIPE', providerReference: null, provenance: mode,
      currency: 'USD', minorExponent: 2, expectedMinor: '9007199254740993', verifiedMinor: null, differenceMinor: null,
      evidenceStatus: 'NOT_VERIFIED', captureId: null, refundRequest: null, createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: null };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', provenance: mode, currency: 'USD',
      readOnly: true, data: pageNumber === 1 ? [row] : [], total: 21, page: pageNumber, limit: 20 }, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
  const panel = page.getByRole('region', { name: 'Payment reconciliation', exact: true });
  await expect(panel.getByText('$90,071,992,547,409.93', { exact: true })).toBeVisible();
  await expect(panel.getByText('Not verified', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Unknown', { exact: true })).toBeVisible();
  await panel.getByRole('combobox', { name: 'Environment' }).click();
  await page.getByRole('option', { name: 'Test / sandbox', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByText('$90,071,992,547,409.93', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('EZH-LIVE', { exact: false })).toHaveCount(0);
  failTest = false;
  await panel.getByRole('button', { name: 'Retry loading reconciliation' }).click();
  await expect(panel.getByRole('heading', { name: 'EZH-TEST · CAPTURE' })).toBeVisible();
  await panel.getByLabel('Order number or transaction reference (exact)').fill('EZH-TEST');
  await panel.getByLabel('Filter by store ID').fill('store-fixture');
  await panel.getByRole('button', { name: 'Apply search' }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('storeId')).toBe('store-fixture');
  await expect(panel.getByRole('button', { name: 'Next operations' })).toBeEnabled();
  await panel.getByRole('button', { name: 'Next operations' }).click();
  await expect(paginationIndicator(panel, isMobile, 2, 2)).toBeVisible();
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('2');
  expect(requests.at(-1)?.searchParams.get('reference')).toBe('EZH-TEST');
  expect(requests.at(-1)?.searchParams.get('provenance')).toBe('TEST');
  await panel.getByRole('combobox', { name: 'Operation status' }).click();
  await page.getByRole('option', { name: 'SUCCEEDED', exact: true }).click();
  await expect(paginationIndicator(panel, isMobile, 1, 2)).toBeVisible();
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('1');
  await expect(panel.getByText('Unknown', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#admin-main-content').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: test.info().outputPath('payment-reconciliation.png'), fullPage: true });
});

test('refund rounding details are exact signed plans, never verified expenses, and malformed plans stay hidden', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let rounding = '-2';
  const writes: string[] = [];
  await page.route('**/api/v1/admin/economic-finances/reconciliation?**', route => {
    if (route.request().method() !== 'GET') writes.push(route.request().method());
    const row = { id: 'refund-operation', orderId: 'order-fixture', orderNumber: 'EZH-REFUND',
      kind: 'REFUND', state: 'NEEDS_RECONCILIATION', provider: 'STRIPE', providerReference: null, provenance: 'LIVE',
      currency: 'USD', minorExponent: 2, expectedMinor: '100', verifiedMinor: null, differenceMinor: null,
      evidenceStatus: 'NOT_VERIFIED', captureId: 'original-capture', createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: null,
      refundRequest: { id: 'refund-request', captureId: 'original-capture', requestedBy: 'synthetic-admin', reason: 'Returned item',
        createdAt: '2026-10-08T00:00:00Z', platformRoundingMinor: rounding } };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', provenance: 'LIVE', currency: 'USD',
      readOnly: true, data: [row], total: 1, page: 1, limit: 20 }, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
  const panel = page.getByRole('region', { name: 'Payment reconciliation', exact: true });
  await panel.getByText('Transaction details', { exact: true }).click();
  await expect(panel.getByText('Planned platform rounding (USD)', { exact: true })).toBeVisible();
  await expect(panel.getByText('-$0.02', { exact: true })).toBeVisible();
  await expect(panel.getByText('Rounding is planned from the original allocations, not a booked expense or proof of refund completion.', { exact: true })).toBeVisible();
  await expect(panel.getByText('Not verified', { exact: true }).first()).toBeVisible();
  rounding = '1';
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(panel.getByText('$0.01', { exact: true })).toBeVisible();
  rounding = '-0';
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByText('Planned platform rounding (USD)', { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('seller cannot open the platform reconciliation screen', async ({ page }) => {
  await session(page);
  let reconciliationRequests = 0;
  await page.route('**/api/v1/admin/economic-finances/reconciliation?**', route => {
    reconciliationRequests++; return route.abort();
  });
  await page.goto('/payouts');
  // Server middleware denies platform-only routes before the page-level fallback.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Review payment reconciliation' })).toHaveCount(0);
  expect(reconciliationRequests).toBe(0);
});

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

test('shared payout modal preserves focus, responsive styling and pending dismissal guard', async ({ page, isMobile }) => {
  await session(page);
  let release = () => { /* installed by the deferred request below */ };
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route('**/api/v1/admin/finances/economic/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      writes++;
      await gate;
      return route.fulfill({ status: 201, json: { success: true, data: { id: 'pending-ui-fixture', state: 'REQUESTED' }, meta: {} } });
    }
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview') ? overview : history, meta: {} } });
  });
  await page.goto('/finances');
  await page.getByLabel('Amount (USD)').fill('12.34');
  const trigger = page.getByRole('button', { name: 'Review request', exact: true });
  await expect(trigger).toHaveClass(/rounded-pill/);
  await trigger.click();
  const modal = page.getByRole('dialog', { name: 'Confirm payout request', exact: true });
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(element => element.matches(':modal'))).toBe(true);
  const panel = modal.locator('.shadow-modal');
  expect(await panel.evaluate(element => getComputedStyle(element).borderTopLeftRadius)).toBe(isMobile ? '24px' : '16px');
  await page.keyboard.press('Tab');
  expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  try {
    await modal.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('shared-payout-modal-pending.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    release();
  }
  await expect(modal).toHaveCount(0);
  expect(writes).toBe(1);
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
  await page.getByRole('combobox', { name: 'Environment', exact: true }).click();
  await page.getByRole('option', { name: 'Test / sandbox', exact: true }).click();
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

test('refund requires two explicit confirmations and ambiguity only offers existing-reference verification', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let pending: { id: string; state: string; amountMinor: string; reason: string; providerReference: string | null } | null = null;
  const prepares: unknown[] = [], executions: unknown[] = [];
  await page.route('**/api/v1/admin/economic-finances/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/refund-options')) return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', captureId: 'capture-fixture', provenance: 'LIVE', currency: 'USD', writesEnabled: true,
      lines: [{ partKey: 'item:original-line', storeId: 'original-store', originalQuantity: 2, remainingQuantity: 2, customerMinor: '200' }],
      unresolvedRequest: pending,
    }, meta: {} } });
    if (url.pathname.endsWith('/refund-requests')) {
      prepares.push(route.request().postDataJSON());
      pending = { id: 'refund-fixture', state: 'PREPARED', amountMinor: '100', reason: 'Original return', providerReference: null };
      return route.fulfill({ json: { success: true, data: pending, meta: {} } });
    }
    if (url.pathname.endsWith('/execute')) {
      executions.push(route.request().postDataJSON());
      pending = { id: 'refund-fixture', state: 'NEEDS_RECONCILIATION', amountMinor: '100', reason: 'Original return', providerReference: 're_synthetic' };
      return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic refund timeout' } } });
    }
    const row = { id: 'operation', orderId: 'order', orderNumber: 'EZH-CAPTURE', kind: 'CAPTURE', state: 'SUCCEEDED', provider: 'STRIPE',
      providerReference: 'ch_synthetic', provenance: 'LIVE', currency: 'USD', minorExponent: 2, expectedMinor: '200', verifiedMinor: '200', differenceMinor: '0',
      evidenceStatus: 'CAPTURE_VERIFIED', captureId: 'capture-fixture', refundRequest: null, createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: '2026-10-08T00:00:01Z' };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', readOnly: true, provenance: 'LIVE', currency: 'USD', data: [row], total: 1, page: 1, limit: 20 }, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
  await page.getByText('Transaction details', { exact: true }).click();
  await page.getByRole('button', { name: 'Review original refund' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Prepare original-allocation refund' })).toBeVisible();
  await modal.getByRole('spinbutton').fill('1');
  await modal.getByLabel('Audit reason').fill('Original return');
  expect(prepares).toHaveLength(0); expect(executions).toHaveLength(0);
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Confirm original refund execution' })).toBeVisible();
  expect(prepares).toHaveLength(1); expect(executions).toHaveLength(0);
  await modal.getByRole('button', { name: 'Confirm refund execution', exact: true }).click();
  await expect(modal.getByRole('alert').filter({ hasText: 'Synthetic refund timeout' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Verify existing refund', exact: true })).toBeVisible();
  await expect(modal.getByLabel('Original provider refund reference')).toHaveValue('re_synthetic');
  await expect(modal.getByLabel('Original provider refund reference')).toHaveAttribute('readonly', '');
  await modal.getByRole('button', { name: 'Verify existing refund', exact: true }).click();
  await expect.poll(() => executions.length).toBe(2);
  expect(executions).toEqual([{}, { reference: 're_synthetic' }]);
  expect(prepares).toHaveLength(1);
  await modal.getByRole('button', { name: 'Close refund review' }).click();
  await expect(page.getByRole('button', { name: 'Review original refund' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('gift wrap refund requires separate unchecked approval and preserves its audit after reload', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  let pending: { id: string; state: string; amountMinor: string; reason: string; requestedBy: string;
    providerReference: null; giftWrapApproval: { approvedBy: string; reason: string } } | null = null;
  const prepares: Record<string, unknown>[] = [], executions: unknown[] = [];
  await page.route('**/api/v1/admin/economic-finances/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/refund-options')) return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', captureId: 'gift-capture', provenance: 'LIVE', currency: 'USD', writesEnabled: true,
      lines: [
        { partKey: 'item:original-line', kind: 'ITEM', storeId: 'original-store', originalQuantity: 1, remainingQuantity: 1, customerMinor: '200' },
        { partKey: 'gift-wrap:original-shop', kind: 'GIFT_WRAP', storeId: 'original-store', originalQuantity: 1, remainingQuantity: 1, customerMinor: '25' },
      ], unresolvedRequest: pending,
    }, meta: {} } });
    if (url.pathname.endsWith('/refund-requests')) {
      prepares.push(route.request().postDataJSON());
      pending = { id: 'gift-refund', state: 'PREPARED', amountMinor: '25', reason: 'Separate gift wrap decision', requestedBy: 'synthetic-owner',
        providerReference: null, giftWrapApproval: { approvedBy: 'synthetic-owner', reason: 'Separate gift wrap decision' } };
      return route.fulfill({ json: { success: true, data: pending, meta: {} } });
    }
    if (url.pathname.endsWith('/execute')) {
      executions.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { success: false, error: { message: 'Synthetic timeout' } } });
    }
    const row = { id: 'gift-operation', orderId: 'order', orderNumber: 'EZH-GIFT', kind: 'CAPTURE', state: 'SUCCEEDED', provider: 'STRIPE',
      providerReference: 'ch_gift', provenance: 'LIVE', currency: 'USD', minorExponent: 2, expectedMinor: '225', verifiedMinor: '225', differenceMinor: '0',
      evidenceStatus: 'CAPTURE_VERIFIED', captureId: 'gift-capture', refundRequest: null, createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: '2026-10-08T00:00:01Z' };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', readOnly: true, provenance: 'LIVE', currency: 'USD', data: [row], total: 1, page: 1, limit: 20 }, meta: {} } });
  });
  async function openRefund() {
    await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
    await page.getByText('Transaction details', { exact: true }).click();
    await page.getByRole('button', { name: 'Review original refund' }).click();
  }
  await page.goto('/payouts'); await openRefund();
  const modal = page.getByRole('dialog');
  await modal.getByRole('spinbutton', { name: /Gift wrap ·/ }).fill('1');
  await modal.getByLabel('Audit reason', { exact: true }).fill('Separate gift wrap decision');
  const approval = modal.getByRole('checkbox', { name: /I separately approve refunding/ });
  await expect(approval).not.toBeChecked();
  await expect(modal.getByRole('button', { name: 'Prepare refund plan', exact: true })).toBeDisabled();
  expect(prepares).toHaveLength(0); expect(executions).toHaveLength(0);
  await approval.check();
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Confirm original refund execution' })).toBeVisible();
  expect(prepares).toEqual([{ reason: 'Separate gift wrap decision', idempotencyKey: expect.any(String),
    selection: [{ partKey: 'gift-wrap:original-shop', quantity: 1 }], approveGiftWrap: true }]);
  expect(executions).toHaveLength(0);
  await expect(modal.getByText('Gift wrap refund explicitly approved by synthetic-owner. Reason: Separate gift wrap decision', { exact: true })).toBeVisible();
  await page.reload(); await openRefund();
  await expect(modal.getByText('$0.25 · PREPARED', { exact: true })).toBeVisible();
  await expect(modal.getByText('Gift wrap refund explicitly approved by synthetic-owner. Reason: Separate gift wrap decision', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Confirm refund execution', exact: true })).toBeVisible();
  expect(prepares).toHaveLength(1); expect(executions).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Review original refund' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shipping exceptions require separate capped approval, preserve audit on reload and never dispatch during preparation', async ({ page }) => {
  await session(page, 'SUPER_ADMIN'); let pending: Record<string, unknown> | null = null;
  const prepares: unknown[] = [], executions: unknown[] = [];
  await page.route('**/api/v1/admin/economic-finances/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/refund-options')) return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', captureId: 'shipping-capture', provenance: 'LIVE', currency: 'USD', writesEnabled: true,
      lines: [{ partKey: 'shipping:original-shop', kind: 'SHIPPING', storeId: 'original-store', originalQuantity: 1,
        remainingQuantity: 1, customerMinor: '500', remainingCustomerMinor: '300', shippingEligible: false }], unresolvedRequest: pending,
    }, meta: {} } });
    if (url.pathname.endsWith('/shipping-refund-override')) {
      prepares.push(route.request().postDataJSON());
      pending = { id: 'shipping-exception', state: 'PREPARED', amountMinor: '125', reason: 'Approved after handoff', requestedBy: 'synthetic-owner',
        providerReference: null, shippingOverrideApproval: { approvedBy: 'synthetic-owner', reason: 'Approved after handoff', amountMinor: '125', evidenceReference: 'case-1' } };
      return route.fulfill({ json: { success: true, data: pending, meta: {} } });
    }
    if (url.pathname.endsWith('/execute')) { executions.push(route.request().postDataJSON()); return route.abort(); }
    const row = { id: 'shipping-operation', orderId: 'order', orderNumber: 'EZH-SHIPPING', kind: 'CAPTURE', state: 'SUCCEEDED', provider: 'STRIPE',
      providerReference: 'ch_shipping', provenance: 'LIVE', currency: 'USD', minorExponent: 2, expectedMinor: '600', verifiedMinor: '600', differenceMinor: '0',
      evidenceStatus: 'CAPTURE_VERIFIED', captureId: 'shipping-capture', refundRequest: null, createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: '2026-10-08T00:00:01Z' };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', readOnly: true, provenance: 'LIVE', currency: 'USD', data: [row], total: 1, page: 1, limit: 20 }, meta: {} } });
  });
  async function review() {
    await page.goto('/payouts'); await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
    await page.getByText('Transaction details', { exact: true }).click(); await page.getByRole('button', { name: 'Review original refund' }).click();
  }
  await review(); let modal = page.getByRole('dialog');
  const approval = modal.getByRole('checkbox', { name: /I separately approve a shipping exception/ });
  await expect(approval).not.toBeChecked(); await approval.check();
  await modal.getByLabel('Original shipping allocation').click();
  await page.keyboard.press('Escape');
  await expect(modal.getByLabel('Original shipping allocation')).toHaveAttribute('aria-expanded', 'false');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Original shipping allocation').click();
  await modal.getByRole('option', { name: /shipping:original-shop/ }).click();
  await modal.getByLabel('Approved shipping refund (USD)').fill('3.01');
  await modal.getByLabel('Audit evidence reference').fill('case-1');
  await modal.getByLabel('Audit reason', { exact: true }).fill('Approved after handoff');
  await modal.screenshot({ path: test.info().outputPath('shipping-refund-review.png') });
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('no greater than its remaining');
  await expect(modal.getByRole('alert')).toBeFocused(); expect(prepares).toHaveLength(0);
  await modal.getByLabel('Approved shipping refund (USD)').fill('1.25');
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Confirm original refund execution' })).toBeVisible();
  expect(prepares).toEqual([{ partKey: 'shipping:original-shop', amountMinor: '125', evidenceReference: 'case-1', reason: 'Approved after handoff', idempotencyKey: expect.any(String) }]);
  expect(executions).toHaveLength(0);
  await expect(modal).toContainText('Shipping exception explicitly approved by synthetic-owner for $1.25.');
  await page.reload(); await review(); modal = page.getByRole('dialog');
  await expect(modal).toContainText('Audit reference: case-1');
  await expect(modal).toContainText('not provider proof');
  await expect(modal.getByRole('button', { name: 'Confirm refund execution', exact: true })).toBeVisible();
  expect(prepares).toHaveLength(1); expect(executions).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Review original refund' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shipping refund requires every remaining shop item and never executes when preparing a plan', async ({ page }) => {
  await session(page, 'SUPER_ADMIN'); let pending: Record<string, unknown> | null = null;
  const prepares: unknown[] = [], executions: unknown[] = [];
  await page.route('**/api/v1/admin/economic-finances/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/refund-options')) return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', captureId: 'shipping-capture', provenance: 'LIVE', currency: 'USD', writesEnabled: true,
      lines: [
        { partKey: 'item:original-line', kind: 'ITEM', storeId: 'original-store', originalQuantity: 2, remainingQuantity: 2, customerMinor: '200' },
        { partKey: 'shipping:original-shop', kind: 'SHIPPING', storeId: 'original-store', originalQuantity: 1, remainingQuantity: 1, customerMinor: '50', shippingEligible: true },
        { partKey: 'shipping:handed-off-shop', kind: 'SHIPPING', storeId: 'other-store', originalQuantity: 1, remainingQuantity: 1, customerMinor: '50', shippingEligible: false },
      ], unresolvedRequest: pending,
    }, meta: {} } });
    if (url.pathname.endsWith('/refund-requests')) {
      prepares.push(route.request().postDataJSON());
      pending = { id: 'shipping-refund', state: 'PREPARED', amountMinor: '250', reason: 'Full cancelled shop before handoff', requestedBy: 'synthetic-owner',
        providerReference: null, shippingEligibility: { policy: '2026-10-08.full-shop-pre-handoff.v1', storeOrderIds: ['original-shop'] } };
      return route.fulfill({ json: { success: true, data: pending, meta: {} } });
    }
    if (url.pathname.endsWith('/execute')) { executions.push(route.request().postDataJSON()); return route.abort(); }
    const row = { id: 'shipping-operation', orderId: 'order', orderNumber: 'EZH-SHIPPING', kind: 'CAPTURE', state: 'SUCCEEDED', provider: 'STRIPE',
      providerReference: 'ch_shipping', provenance: 'LIVE', currency: 'USD', minorExponent: 2, expectedMinor: '300', verifiedMinor: '300', differenceMinor: '0',
      evidenceStatus: 'CAPTURE_VERIFIED', captureId: 'shipping-capture', refundRequest: null, createdAt: '2026-10-08T00:00:00Z',
      dispatchedAt: null, reconcileAfter: null, completedAt: null, verifiedAt: '2026-10-08T00:00:01Z' };
    return route.fulfill({ json: { success: true, data: { version: 'economic-v1', readOnly: true, provenance: 'LIVE', currency: 'USD', data: [row], total: 1, page: 1, limit: 20 }, meta: {} } });
  });
  await page.goto('/payouts'); await page.getByRole('button', { name: 'Review payment reconciliation' }).click();
  await page.getByText('Transaction details', { exact: true }).click(); await page.getByRole('button', { name: 'Review original refund' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('spinbutton', { name: /shipping:handed-off-shop/ })).toBeDisabled();
  await modal.getByRole('spinbutton', { name: /shipping:original-shop/ }).fill('1');
  await modal.getByRole('spinbutton', { name: /item:original-line/ }).fill('1');
  await modal.getByLabel('Audit reason', { exact: true }).fill('Full cancelled shop before handoff');
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('all remaining original shop items'); expect(prepares).toHaveLength(0);
  await modal.getByRole('spinbutton', { name: /item:original-line/ }).fill('2');
  await modal.getByRole('button', { name: 'Prepare refund plan', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Confirm original refund execution' })).toBeVisible();
  expect(prepares).toEqual([{ reason: 'Full cancelled shop before handoff', idempotencyKey: expect.any(String),
    selection: [{ partKey: 'item:original-line', quantity: 2 }, { partKey: 'shipping:original-shop', quantity: 1 }] }]);
  await expect(modal.getByText('Original customer-paid shipping included', { exact: false })).toBeVisible(); expect(executions).toHaveLength(0);
  await page.keyboard.press('Escape'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('platform debt recovery confirms the exact account and does not send an external transfer', async ({ page }) => {
  await session(page, 'SUPER_ADMIN');
  const writes: URL[] = [];
  const reads: string[] = [];
  let capturedMinor = '10000';
  await page.route('**/api/v1/admin/economic-finances/**', route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      writes.push(url);
      return route.fulfill({ json: { success: true, data: { recoveredMinor: '75' }, meta: {} } });
    }
    reads.push(url.pathname);
    if (url.pathname.endsWith('/summary')) return route.fulfill({ json: { success: true, data: {
      version: 'economic-v1', provenance: 'LIVE', currency: 'USD', minorExponent: 2, readOnly: true,
      basis: 'IMMUTABLE_VERIFIED_EVIDENCE', legacyIncluded: false,
      capturedMinor, refundedMinor: '0', netCollectedMinor: capturedMinor, paidOutMinor: '0',
      outstandingDebtMinor: writes.length ? '25' : '100', recoveredDebtMinor: writes.length ? '75' : '0',
      bookedRefundRoundingMinor: '0', actualProviderFeeMinor: null, actualShippingCostMinor: null,
    }, meta: {} } });
    return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/overview')
      ? { ...overview, capturedMinor, debtMinor: writes.length ? '25' : '100', reversedMinor: '100', debtRecoveredMinor: writes.length ? '75' : '0', debtRecoveryEnabled: true } : history, meta: {} } });
  });
  await page.goto('/payouts');
  await page.getByRole('button', { name: 'Review verified money totals' }).click();
  const summary = page.getByRole('region', { name: 'Verified money totals', exact: true });
  const summaryDebt = summary.locator('dl > div').filter({ has: page.getByText('Outstanding refund debt', { exact: true }) });
  await expect(summaryDebt).toContainText('$1.00');
  await page.getByLabel('Store ID', { exact: true }).fill('synthetic-store');
  await page.getByRole('button', { name: 'View verified account' }).click();
  await page.getByRole('button', { name: 'Review debt recovery' }).click();
  await expect(page.getByRole('dialog').getByText('LIVE · SELLER · synthetic-store', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.keyboard.press('Escape');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Review debt recovery' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm debt recovery' }).click();
  await expect(page.getByText('$0.75 retained against debt.', { exact: false })).toBeVisible();
  await expect(summaryDebt).toContainText('$0.25');
  expect(writes).toHaveLength(1);
  expect(writes[0].pathname).toBe('/api/v1/admin/economic-finances/debt/recover');
  expect(writes[0].searchParams.get('beneficiaryId')).toBe('synthetic-store');
  expect(writes[0].searchParams.get('provenance')).toBe('LIVE');
  const summaryReads = reads.filter(path => path.endsWith('/summary')).length;
  const overviewReads = reads.filter(path => path.endsWith('/overview')).length;
  capturedMinor = '12500';
  await page.getByRole('button', { name: 'Reload data' }).click();
  await expect.poll(() => reads.filter(path => path.endsWith('/summary')).length).toBeGreaterThan(summaryReads);
  await expect.poll(() => reads.filter(path => path.endsWith('/overview')).length).toBeGreaterThan(overviewReads);
  await expect(summary.getByText('$125.00', { exact: true }).first()).toBeVisible();
  expect(writes).toHaveLength(1);
});
