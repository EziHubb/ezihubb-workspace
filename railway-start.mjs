import { execSync } from 'child_process';

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
    run('node node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma');
    console.log('[railway-start] Migrations applied');
  } catch {
    try {
      run('node node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss');
    } catch {
      console.error('[railway-start] DB setup failed — starting anyway');
    }
  }
}

if (service.includes('api') || (!service.includes('client') && !service.includes('admin') && !service.includes('web'))) {
  tryMigrate();
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  run('node node_modules/next/dist/bin/next start dist/apps/admin --port ' + (process.env['PORT'] || '3001'));

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  run('node node_modules/next/dist/bin/next start dist/apps/client --port ' + (process.env['PORT'] || '3000'));
}
