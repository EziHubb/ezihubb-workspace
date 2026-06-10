import { execSync } from 'child_process';

console.log('[railway-build] Building all services...');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// RAILWAY_SERVICE_NAME is only available at runtime, not as a Docker build ARG,
// so we always build all three services. The runtime script selects the right one.
run('node node_modules/.bin/prisma generate --schema=prisma/schema.prisma');
run('pnpm nx build api --configuration=production');
run('pnpm nx build client --configuration=production');
run('pnpm nx build admin --configuration=production');

console.log('[railway-build] Done.');
