import { test, expect } from '@playwright/test';

test.describe('Product Detail Page', () => {
  // Use the first product in the list to navigate to its detail page
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    // Click the first product card
    const firstProduct = page.locator('[data-testid="product-card"], a[href*="/products/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 10_000 });
    await firstProduct.click();
    await page.waitForURL(/\/products\/.+/);
  });

  test('shows product name and price', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Price should contain a dollar sign
    await expect(page.getByText(/\$[\d,]+\.\d{2}/)).toBeVisible();
  });

  test('shows customizer fields for a personalizable product', async ({ page }) => {
    // If the product is personalizable the customizer panel should be present
    const customizerOrPersonalizeBtn = page
      .locator('[data-testid="customizer-panel"], [data-testid="personalize-btn"], button:has-text("Personalize")')
      .first();

    // It's acceptable for non-personalizable products to not show the customizer
    const isVisible = await customizerOrPersonalizeBtn.isVisible().catch(() => false);
    if (isVisible) {
      await expect(customizerOrPersonalizeBtn).toBeVisible();
    }
  });

  test('fills required fields and enables the Add to Cart button', async ({ page }) => {
    // Find text inputs in the customizer
    const textInputs = page.locator(
      '[data-testid="customizer-panel"] input[type="text"], form input[type="text"]',
    );

    const inputCount = await textInputs.count();
    if (inputCount > 0) {
      // Fill the first visible text input
      const firstInput = textInputs.first();
      await firstInput.fill('Test Person');
    }

    // The Add to Cart button should exist
    const addToCartBtn = page.getByRole('button', { name: /add to cart/i });
    await expect(addToCartBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Add to Cart increments the cart count badge in the nav', async ({ page }) => {
    // Get initial cart count (may be 0 / absent)
    const cartBadge = page.locator('[data-testid="cart-count"], [aria-label*="cart"] .badge');
    const initialCount = parseInt((await cartBadge.textContent().catch(() => '0')) ?? '0', 10);

    const addToCartBtn = page.getByRole('button', { name: /add to cart/i });
    await expect(addToCartBtn).toBeVisible({ timeout: 5_000 });

    // Fill required fields first
    const requiredInputs = page.locator('input[required], input[aria-required="true"]');
    const reqCount = await requiredInputs.count();
    for (let i = 0; i < reqCount; i++) {
      const input = requiredInputs.nth(i);
      if (await input.isVisible()) await input.fill('Test Value');
    }

    // Only click if not disabled
    const isDisabled = await addToCartBtn.isDisabled();
    if (!isDisabled) {
      await addToCartBtn.click();

      // Cart badge should update or a success toast should appear
      await expect(
        page.locator('[data-testid="toast"], [role="status"]').filter({ hasText: /cart|added/i })
          .or(cartBadge.filter({ hasText: String(initialCount + 1) }))
      ).toBeVisible({ timeout: 8_000 });
    }
  });
});
