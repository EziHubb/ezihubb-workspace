import { execSync } from 'child_process';
import { existsSync } from 'fs';

const service = process.env.RAILWAY_SERVICE_NAME ?? '';

console.log(`[railway-start] Starting service: "${service}"`);

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function tryMigrate() {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.warn('[railway-start] DATABASE_URL not set — skipping migrations');
    return;
  }
  try {
    run('pnpm exec prisma migrate deploy --schema=prisma/schema.prisma');
    console.log('[railway-start] Migrations applied successfully');
  } catch {
    console.warn('[railway-start] migrate deploy failed, trying db push...');
    try {
      run('pnpm exec prisma db push --schema=prisma/schema.prisma --accept-data-loss');
    } catch {
      console.error('[railway-start] DB setup failed — starting API anyway');
    }
  }
}

if (service.includes('api') || (!service.includes('client') && !service.includes('admin') && !service.includes('web'))) {
  tryMigrate();
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  // Nx outputs Next.js build to dist/apps/admin
  // next start <dir> looks for .next inside that directory
  const distStandalone = 'dist/apps/admin/.next/standalone/server.js';
  if (existsSync(distStandalone)) {
    run(`node ${distStandalone}`);
  } else {
    run('pnpm exec next start dist/apps/admin');
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  // Nx outputs Next.js build to dist/apps/client
  const distStandalone = 'dist/apps/client/.next/standalone/server.js';
  if (existsSync(distStandalone)) {
    run(`node ${distStandalone}`);
  } else {
    run('pnpm exec next start dist/apps/client');
  }
}
