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

  for (const labels of [
    { locale: 'en', heading: 'Search results for keepsake', sort: 'Sort results', filters: 'Filters', showFilters: 'Show filters', min: 'Min price', max: 'Max price' },
    { locale: 'vi', heading: 'Kết quả tìm kiếm cho keepsake', sort: 'Sắp xếp kết quả', filters: 'Bộ lọc', showFilters: 'Hiện bộ lọc', min: 'Giá từ', max: 'Giá đến' },
    { locale: 'zh', heading: 'keepsake的搜索结果', sort: '排序搜索结果', filters: '筛选', showFilters: '显示筛选', min: '最低价', max: '最高价' },
  ]) {
    test(`search heading and price controls are named in ${labels.locale}`, async ({ page }) => {
      await page.route('https://api.ezihubb.test/**', route => route.fulfill({ json: {
        success: true,
        data: new URL(route.request().url()).pathname.endsWith('/search') ? {
          data: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
          facets: {}, appliedFilters: {}, correctedQuery: null,
        } : [],
        meta: {},
      } }));
      await page.goto(`/${labels.locale}/search?q=keepsake`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(labels.heading);
      await expect(page.getByRole('combobox', { name: labels.sort, exact: true })).toBeVisible();
      await page.getByRole('button', { name: labels.filters, exact: true })
        .or(page.getByRole('button', { name: labels.showFilters, exact: true })).click();
      await expect(page.getByRole('spinbutton', { name: labels.min, exact: true })).toBeVisible();
      await expect(page.getByRole('spinbutton', { name: labels.max, exact: true })).toBeVisible();
    });
  }

  test('non-essential trackers are absent before cookie consent', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem('cookie_consent'));
    await page.goto('/en');
    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
    await expect(page.locator('#meta-pixel, #pinterest-tag, #hotjar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.locator('#meta-pixel, #pinterest-tag, #hotjar')).toHaveCount(0);
  });
});
