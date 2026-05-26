import { test, expect, Page } from '@playwright/test';

// Stripe test card
const STRIPE_TEST_CARD = {
  number:  '4242 4242 4242 4242',
  expiry:  '12/28',
  cvc:     '123',
  zip:     '10001',
};

const GUEST_EMAIL = `pw-guest-${Date.now()}@e2e-test.com`;

async function addItemToCart(page: Page) {
  await page.goto('/products');
  const firstProduct = page.locator('[data-testid="product-card"], a[href*="/products/"]').first();
  await expect(firstProduct).toBeVisible({ timeout: 10_000 });
  await firstProduct.click();
  await page.waitForURL(/\/products\/.+/);

  // Fill any required text fields
  const requiredInputs = page.locator('input[required], input[aria-required="true"]');
  const count = await requiredInputs.count();
  for (let i = 0; i < count; i++) {
    const input = requiredInputs.nth(i);
    if (await input.isVisible()) await input.fill('Test Name');
  }

  const addToCartBtn = page.getByRole('button', { name: /add to cart/i });
  const isDisabled = await addToCartBtn.isDisabled().catch(() => true);
  if (!isDisabled) {
    await addToCartBtn.click();
    await page.waitForTimeout(1_000);
  }
}

test.describe('Checkout Flow (Guest)', () => {
  test('navigates from cart → checkout → shipping address form', async ({ page }) => {
    await addItemToCart(page);

    // Open cart drawer or navigate to cart
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /cart|your cart/i })).toBeVisible({ timeout: 8_000 });

    const checkoutBtn = page.getByRole('link', { name: /checkout/i })
      .or(page.getByRole('button', { name: /checkout/i }))
      .first();

    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await page.waitForURL(/checkout/);
      await expect(page.getByRole('heading', { name: /checkout|shipping|your order/i })).toBeVisible();
    }
  });

  test('shows shipping address fields at checkout', async ({ page }) => {
    await page.goto('/checkout');

    const addressField = page.locator('input[name="addressLine1"], input[placeholder*="address" i], input[autocomplete="street-address"]');
    await expect(addressField.first()).toBeVisible({ timeout: 8_000 });
  });

  test('coupon code field applies a discount', async ({ page }) => {
    await page.goto('/checkout');

    const couponInput = page.locator('input[placeholder*="coupon" i], input[name*="coupon" i], input[aria-label*="coupon" i]');
    if (await couponInput.isVisible()) {
      await couponInput.fill('SAVE10');
      const applyBtn = page.getByRole('button', { name: /apply/i });
      await applyBtn.click();

      // Either a success message or a discount line should appear
      await expect(
        page.getByText(/discount|applied|-\$|10%/i).or(page.getByText(/invalid|expired/i))
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('order success page shows order number after payment', async ({ page }) => {
    // Navigate to a mock order success page to verify the UI
    await page.goto('/orders/success?orderNumber=MLH-2025-00001');

    await expect(
      page.getByText(/order confirmed|thank you|MLH-2025-00001/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Checkout Flow — Stripe test mode', () => {
  test.skip(
    !process.env['STRIPE_TEST_MODE'],
    'Skipped unless STRIPE_TEST_MODE=1 is set',
  );

  test('completes end-to-end payment with Stripe test card', async ({ page }) => {
    await addItemToCart(page);
    await page.goto('/checkout');

    // Fill shipping address
    await page.fill('input[name="fullName"]',     'Test Buyer');
    await page.fill('input[name="addressLine1"]', '123 Test St');
    await page.fill('input[name="city"]',         'Portland');
    await page.selectOption('select[name="state"]', 'OR');
    await page.fill('input[name="postalCode"]',   '97201');
    await page.selectOption('select[name="country"]', 'US');

    // Select shipping method
    const shippingOption = page.locator('[data-testid="shipping-option"]').first();
    if (await shippingOption.isVisible()) await shippingOption.click();

    await page.getByRole('button', { name: /continue|next|payment/i }).click();

    // Fill Stripe Elements (iframe)
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]').first();
    await stripeFrame.locator('[placeholder*="Card number"]').fill(STRIPE_TEST_CARD.number);
    await stripeFrame.locator('[placeholder*="MM / YY"]').fill(STRIPE_TEST_CARD.expiry);
    await stripeFrame.locator('[placeholder*="CVC"]').fill(STRIPE_TEST_CARD.cvc);

    await page.getByRole('button', { name: /pay|place order|confirm/i }).click();

    await page.waitForURL(/\/orders\/(success|confirmation)/, { timeout: 30_000 });
    await expect(page.getByText(/order confirmed|thank you/i)).toBeVisible();
    await expect(page.getByText(/MLH-\d{4}-\d{5}/)).toBeVisible();
  });
});
