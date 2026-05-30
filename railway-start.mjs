import { execSync } from 'child_process';
import { existsSync } from 'fs';

const service = process.env.RAILWAY_SERVICE_NAME ?? '';

console.log(`[railway-start] Starting service: "${service}"`);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (service.includes('api')) {
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  const standalone = 'apps/admin/.next/standalone/apps/admin/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else {
    // fallback if standalone path differs
    run('pnpm nx start admin');
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  const standalone = 'apps/client/.next/standalone/apps/client/server.js';
  if (existsSync(standalone)) {
    run(`node ${standalone}`);
  } else {
    run('pnpm nx start client');
  }

} else {
  console.warn(`[railway-start] Unknown service "${service}", defaulting to API`);
  run('node dist/apps/api/main.js');
}
