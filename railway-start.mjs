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
  // Try standalone server first, then fallback to next start from app dir
  const standalone = 'apps/admin/.next/standalone/server.js';
  const standaloneNested = 'apps/admin/.next/standalone/apps/admin/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else if (existsSync(standaloneNested)) {
    run(`node ${standaloneNested}`);
  } else {
    // Run next start from the app directory so it finds .next/
    run('pnpm exec next start', { cwd: 'apps/admin' });
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  // Try standalone server first, then fallback to next start from app dir
  const standalone = 'apps/client/.next/standalone/server.js';
  const standaloneNested = 'apps/client/.next/standalone/apps/client/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else if (existsSync(standaloneNested)) {
    run(`node ${standaloneNested}`);
  } else {
    // Run next start from the app directory so it finds .next/
    run('pnpm exec next start', { cwd: 'apps/client' });
  }
}
