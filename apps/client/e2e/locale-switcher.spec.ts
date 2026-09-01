import { expect, test } from '@playwright/test';

test.describe('locale switching', () => {
  // The state probe lives in the desktop header. LocaleSwitcher itself uses
  // the same switchLocale path for both dropdown and mobile inline variants.
  test.use({ viewport: { width: 1280, height: 900 } });

  test('translates in place without losing route or local UI state', async ({ page }) => {
    await page.goto('/en?campaign=locale-state#main-content');

    const search = page.locator('input[type="search"]').first();
    await search.fill('unfinished personalized gift');

    await page.getByRole('button', { name: 'Select language' }).click();
    await page.getByRole('option', { name: /Tiếng Việt/ }).click();

    await expect(page).toHaveURL(/\/vi\?campaign=locale-state#main-content$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(search).toHaveValue('unfinished personalized gift');
    await expect(page.getByRole('button', { name: 'Chọn ngôn ngữ' })).toBeVisible();
  });

  test('uses the same state-preserving transition from the mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en?source=mobile-locale');

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();

    await expect(page).toHaveURL(/\/vi\?source=mobile-locale$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });

  test('keeps a checkout wizard on its completed step', async ({ page }) => {
    await page.route('**/api/v1/cart**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meta: {},
          data: {
            id: 'cart-locale-test',
            items: [{
              id: 'item-locale-test',
              productId: 'product-locale-test',
              productType: 'PHYSICAL',
              product: { name: 'Locale test product', slug: 'locale-test', images: [] },
              quantity: 1,
              unitPrice: 20,
              currentPrice: 20,
              productName: 'Locale test product',
              productSlug: 'locale-test',
              productImageUrl: null,
              variantName: null,
              priceChanged: false,
              totalPrice: 20,
            }],
            discountAmount: 0,
            subtotal: 20,
            itemCount: 1,
            totals: { subtotal: 20, discount: 0, shipping: 0, total: 20, itemCount: 1 },
          },
        }),
      });
    });

    await page.goto('/en/checkout');
    await page.locator('[autocomplete="email"]').fill('buyer@example.com');
    await page.locator('[autocomplete="given-name"]').fill('Test');
    await page.locator('[autocomplete="family-name"]').fill('Buyer');
    await page.locator('[autocomplete="tel"]').fill('+1 555 000 0000');
    await page.locator('[autocomplete="address-line1"]').fill('123 Main Street');
    await page.locator('[autocomplete="address-level2"]').fill('Austin');
    await page.locator('[autocomplete="address-level1"]').fill('TX');
    await page.locator('[autocomplete="postal-code"]').fill('78701');
    await page.getByRole('button', { name: /Continue to Delivery/ }).click();
    await expect(page.locator('#step2-heading')).toBeVisible();

    await page.getByRole('button', { name: 'Select language' }).click();
    await page.getByRole('option', { name: /Tiếng Việt/ }).click();

    await expect(page).toHaveURL(/\/vi\/checkout$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.locator('#step2-heading')).toBeVisible();
    await expect(page.locator('#step1-heading')).toHaveCount(0);
  });
});
