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
  // With output: standalone, must use node server.js directly
  const port = process.env['PORT'] || '3001';
  const candidates = [
    'dist/apps/admin/.next/standalone/server.js',
    'dist/apps/admin/server.js',
    'apps/admin/.next/standalone/server.js',
  ];
  const serverJs = candidates.find(existsSync);
  if (serverJs) {
    process.env['PORT'] = port;
    process.env['HOSTNAME'] = '0.0.0.0';
    run(`node ${serverJs}`);
  } else {
    console.error('[railway-start] standalone server.js not found, searched:', candidates);
    process.exit(1);
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  // With output: standalone, must use node server.js directly
  const port = process.env['PORT'] || '3000';
  const candidates = [
    'dist/apps/client/.next/standalone/server.js',
    'dist/apps/client/server.js',
    'apps/client/.next/standalone/server.js',
  ];
  const serverJs = candidates.find(existsSync);
  if (serverJs) {
    process.env['PORT'] = port;
    process.env['HOSTNAME'] = '0.0.0.0';
    run(`node ${serverJs}`);
  } else {
    console.error('[railway-start] standalone server.js not found, searched:', candidates);
    process.exit(1);
  }
}
