import { execSync } from 'child_process';
import { existsSync } from 'fs';

const service = process.env.RAILWAY_SERVICE_NAME ?? '';

console.log(`[railway-start] Starting service: "${service}"`);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
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
  } catch (e1) {
    console.warn('[railway-start] migrate deploy failed, trying db push...');
    try {
      run('pnpm exec prisma db push --schema=prisma/schema.prisma --accept-data-loss');
      console.log('[railway-start] db push applied successfully');
    } catch (e2) {
      console.error('[railway-start] DB setup failed — starting API anyway');
    }
  }
}

if (service.includes('api') || (!service.includes('client') && !service.includes('admin') && !service.includes('web'))) {
  tryMigrate();
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  const standalone = 'apps/admin/.next/standalone/apps/admin/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else {
    run('pnpm nx start admin');
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  const standalone = 'apps/client/.next/standalone/apps/client/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else {
    run('pnpm nx start client');
  }
}
