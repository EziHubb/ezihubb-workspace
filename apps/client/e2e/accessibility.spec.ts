import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function expectNoSeriousAccessibilityViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('storefront accessibility', () => {
  test('home has landmarks, keyboard skip navigation, and no serious axe violations', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('main#main-content')).toBeVisible();

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await expectNoSeriousAccessibilityViolations(page);
  });

  test('search combobox has an accessible name', async ({ page }) => {
    await page.goto('/en/search');
    await expect(page.getByRole('combobox', { name: /search/i }).first()).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  });

  test('non-essential trackers are absent before cookie consent', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem('cookie_consent'));
    await page.goto('/en');
    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
    await expect(page.locator('#meta-pixel, #pinterest-tag, #hotjar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.locator('#meta-pixel, #pinterest-tag, #hotjar')).toHaveCount(0);
  });
});
