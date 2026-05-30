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

function startNextApp(appName, port) {
  // Nx monorepo standalone path: dist/apps/<name>/.next/standalone/apps/<name>/server.js
  const serverJs = `dist/apps/${appName}/.next/standalone/apps/${appName}/server.js`;

  if (!existsSync(serverJs)) {
    console.error(`[railway-start] server.js not found at ${serverJs}`);
    process.exit(1);
  }

  // Copy static assets into standalone directory (required by Next.js standalone)
  const staticSrc = `dist/apps/${appName}/.next/static`;
  const staticDest = `dist/apps/${appName}/.next/standalone/apps/${appName}/.next/static`;
  if (existsSync(staticSrc) && !existsSync(staticDest)) {
    run(`cp -r ${staticSrc} ${staticDest}`);
  }

  const publicSrc = `dist/apps/${appName}/public`;
  const publicDest = `dist/apps/${appName}/.next/standalone/apps/${appName}/public`;
  if (existsSync(publicSrc) && !existsSync(publicDest)) {
    run(`cp -r ${publicSrc} ${publicDest}`);
  }

  process.env['PORT'] = String(port);
  process.env['HOSTNAME'] = '0.0.0.0';
  console.log(`[railway-start] Starting ${appName} on port ${port} via ${serverJs}`);
  run(`node ${serverJs}`);
}

if (service.includes('api') || (!service.includes('client') && !service.includes('admin') && !service.includes('web'))) {
  tryMigrate();
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  startNextApp('admin', process.env['PORT'] || 3001);

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  startNextApp('client', process.env['PORT'] || 3000);
}
