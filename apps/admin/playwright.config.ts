import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './e2e', workers: 1, fullyParallel: false, timeout: 120_000,
  outputDir: '../../test-results/admin',
  use: { baseURL: 'http://127.0.0.1:3001', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3001', cwd: resolve(__dirname),
    url: 'http://127.0.0.1:3001/login', reuseExistingServer: false, timeout: 180_000,
    env: { ...process.env, API_URL: 'https://api.ezihubb.test', NEXT_PUBLIC_API_URL: 'https://api.ezihubb.test',
      NEXTAUTH_URL: 'http://127.0.0.1:3001', NEXTAUTH_SECRET: 'admin-e2e-local-synthetic-secret' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
