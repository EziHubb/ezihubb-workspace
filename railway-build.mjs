import { execSync } from 'child_process';

console.log('[railway-build] Building all services...');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

const prisma = 'node node_modules/prisma/build/index.js';
const nx     = 'node node_modules/nx/dist/bin/nx.js';

// RAILWAY_SERVICE_NAME is only available at runtime, not as a Docker build ARG,
// so we always build all three services. The runtime script selects the right one.
run(`${prisma} generate --schema=prisma/schema.prisma`);
run(`${nx} build api --configuration=production`);
run(`${nx} build client --configuration=production`);
run(`${nx} build admin --configuration=production`);

console.log('[railway-build] Done.');
