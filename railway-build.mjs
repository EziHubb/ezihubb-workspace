import { execSync } from 'child_process';

const service = process.env.RAILWAY_SERVICE_NAME ?? '';

console.log(`[railway-build] Building service: "${service}"`);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (service.includes('api')) {
  run('pnpm exec prisma generate --schema=prisma/schema.prisma');
  run('pnpm nx build api --configuration=production');

} else if (service.includes('admin')) {
  run('pnpm nx build admin --configuration=production');

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  run('pnpm nx build client --configuration=production');

} else {
  // fallback: default build API
  console.warn(`[railway-build] Unknown service name "${service}", defaulting to API build`);
  run('pnpm exec prisma generate --schema=prisma/schema.prisma');
  run('pnpm nx build api --configuration=production');
}

console.log('[railway-build] Done.');
