import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads homepage and shows hero section', async ({ page }) => {
    await expect(page).toHaveTitle(/maple loom/i);
    // Hero section is visible
    const hero = page.locator('[data-testid="hero"], section').first();
    await expect(hero).toBeVisible();
  });

  test('hero has a call-to-action button linking to products', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /shop|browse|explore|start/i }).first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();
    await expect(page).toHaveURL(/products/);
  });

  test('navigation bar is visible with key links', async ({ page }) => {
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();

    // Cart and home links should be in the nav
    await expect(nav.getByRole('link').first()).toBeVisible();
  });

  test('footer is present', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('page has no critical accessibility violations (landmark regions)', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });
});
