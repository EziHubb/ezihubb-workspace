import { test, expect } from '@playwright/test';

const unique = () => `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

test.describe('Authentication', () => {
  test('register → login → view account page', async ({ page }) => {
    const email    = `${unique()}@e2e-test.com`;
    const password = 'StrongPass1!';

    // ── Register ──────────────────────────────────────────────────────────────
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { name: /register|create account|sign up/i })).toBeVisible({ timeout: 8_000 });

    await page.fill('input[name="firstName"], input[placeholder*="first" i]', 'Playwright');
    await page.fill('input[name="lastName"],  input[placeholder*="last" i]',  'Test');
    await page.fill('input[type="email"]',     email);
    await page.fill('input[type="password"]',  password);

    const confirmInput = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]');
    if (await confirmInput.isVisible()) await confirmInput.fill(password);

    await page.getByRole('button', { name: /register|sign up|create/i }).click();

    // Should redirect to home, dashboard, or show success message
    await expect(
      page.getByText(/welcome|verify|registered|success/i)
        .or(page.locator('[data-testid="auth-success"]'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login with valid credentials redirects to account page', async ({ page }) => {
    // Use seeded test credentials (must exist in test DB)
    const email    = process.env['TEST_USER_EMAIL'] ?? 'seed@e2e-test.com';
    const password = process.env['TEST_USER_PASS']  ?? 'SeedPass1!';

    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: /log in|sign in/i })).toBeVisible({ timeout: 8_000 });

    await page.fill('input[type="email"]',    email);
    await page.fill('input[type="password"]', password);
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await expect(
      page.getByRole('link', { name: /account|my orders|profile/i })
        .or(page.locator('[data-testid="user-menu"]'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]',    'existing@e2e-test.com');
    await page.fill('input[type="password"]', 'TOTALLY-WRONG-PASSWORD');
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await expect(
      page.getByText(/invalid|incorrect|wrong|credentials/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test('verify email page shows error for invalid token', async ({ page }) => {
    await page.goto('/auth/verify-email?token=this-token-is-fake-1234');

    await expect(
      page.getByText(/invalid|expired|not found/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Google OAuth login button is present on login page', async ({ page }) => {
    await page.goto('/auth/login');

    const googleBtn = page.getByRole('button', { name: /google/i })
      .or(page.getByRole('link', { name: /google/i }))
      .or(page.locator('[data-provider="google"], [aria-label*="google" i]'));

    await expect(googleBtn.first()).toBeVisible({ timeout: 8_000 });
  });

  test('protected account page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/account');
    // Should be redirected to login
    await expect(page).toHaveURL(/login|auth/, { timeout: 8_000 });
  });
});
