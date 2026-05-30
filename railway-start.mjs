import { execSync } from 'child_process';
import { existsSync } from 'fs';

const service = process.env.RAILWAY_SERVICE_NAME ?? '';

console.log(`[railway-start] Starting service: "${service}"`);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (service.includes('api') || (!service.includes('client') && !service.includes('admin') && !service.includes('web'))) {
  // Run DB migrations before starting API
  console.log('[railway-start] Running database migrations...');
  try {
    run('pnpm exec prisma migrate deploy --schema=prisma/schema.prisma');
  } catch {
    // If no migrations exist yet, push schema directly
    console.warn('[railway-start] No migrations found, using prisma db push...');
    run('pnpm exec prisma db push --schema=prisma/schema.prisma --accept-data-loss');
  }
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
