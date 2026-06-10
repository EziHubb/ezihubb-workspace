import { test, expect, type Page } from '@playwright/test';

const ADMIN_BASE = process.env['ADMIN_BASE_URL'] ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@mapleloom.com';
const ADMIN_PASS  = process.env['ADMIN_PASS']  ?? 'Admin1!';

// ── Helper: log into the admin app ───────────────────────────────────────────

async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_BASE}/login`);
  await expect(
    page.getByRole('heading', { name: /sign in|admin/i }),
  ).toBeVisible({ timeout: 10_000 });

  await page.fill('input[type="email"]',    ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Accept either the dashboard heading or a KPI stat card
  await expect(
    page.getByRole('heading', { name: /dashboard/i })
      .or(page.locator('[class*="StatCard"], [data-testid="kpi-card"]').first()),
  ).toBeVisible({ timeout: 15_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Admin — critical paths', () => {

  // 1. Admin login
  test('admin login loads the dashboard', async ({ page }) => {
    await adminLogin(page);

    // Verify the URL has moved away from /login
    await expect(page).not.toHaveURL(/login/, { timeout: 5_000 });

    // Dashboard heading or KPI cards are visible
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
        .or(page.getByText(/revenue this month|orders this month/i).first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 2. Product list loads
  test('product list page renders table or empty state', async ({ page }) => {
    await adminLogin(page);

    await page.goto(`${ADMIN_BASE}/products`);

    // Either the data table rows or the "No products found" empty state
    await expect(
      page.getByRole('heading', { name: /products/i })
        .or(page.getByText(/no products found/i))
        .or(page.locator('table, [role="table"]').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 3. New product form loads with tabs
  test('new product page renders form with tabs', async ({ page }) => {
    await adminLogin(page);

    await page.goto(`${ADMIN_BASE}/products/new`);

    // The product name / title field should appear
    await expect(
      page.locator('input[name="name"], input[placeholder*="title" i], input[placeholder*="name" i]').first()
        .or(page.getByRole('textbox', { name: /title|name/i }).first()),
    ).toBeVisible({ timeout: 10_000 });

    // At least one of the known tab labels should be visible
    await expect(
      page.getByText(/photo.*video|item details|pricing.*shipping|settings/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 4. Order list loads
  test('order list page renders table or empty state', async ({ page }) => {
    await adminLogin(page);

    await page.goto(`${ADMIN_BASE}/orders`);

    await expect(
      page.getByRole('heading', { name: /orders/i })
        .or(page.getByText(/no orders found/i))
        .or(page.locator('table, [role="table"]').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 5. Review moderation page renders list or empty state
  test('reviews page renders moderation cards or empty state', async ({ page }) => {
    await adminLogin(page);

    await page.goto(`${ADMIN_BASE}/reviews`);

    // The Reviews heading should be visible
    await expect(
      page.getByRole('heading', { name: /reviews/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Either review cards with Approve/Hide buttons, or the empty-state text
    const hasReviews = await page.locator('[class*="ReviewModerationCard"], article').first().isVisible()
      .catch(() => false);

    if (hasReviews) {
      // If reviews are present, Approve or Hide button must exist
      await expect(
        page.getByRole('button', { name: /approve|hide/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
    } else {
      // Empty state
      await expect(
        page.getByText(/no.*reviews|all caught up/i),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

});
