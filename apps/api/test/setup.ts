import { execSync } from 'child_process';

export default async function globalSetup() {
  // Apply migrations to the test database before the suite runs.
  // Set TEST_DATABASE_URL in .env.test or CI environment.
  if (process.env['DATABASE_URL']) {
    execSync('pnpm prisma migrate deploy', {
      env: { ...process.env },
      stdio: 'inherit',
    });
  }
}
