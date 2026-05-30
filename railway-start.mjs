/**
 * Railway start script.
 *
 * Static asset copying is handled by `scripts/postbuild.mjs` during the build
 * phase (runs as part of `pnpm build`), so there is nothing to copy here.
 */

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
  const serverJs = `dist/apps/${appName}/.next/standalone/apps/${appName}/server.js`;

  if (!existsSync(serverJs)) {
    console.error(`[railway-start] server.js not found: ${serverJs}`);
    console.error('[railway-start] Did the build run? Expected: pnpm build');
    process.exit(1);
  }

  process.env['PORT']     = String(port);
  process.env['HOSTNAME'] = '0.0.0.0';
  console.log(`[railway-start] Starting ${appName} on port ${port}`);
  run(`node ${serverJs}`);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

if (
  service.includes('api') ||
  (!service.includes('client') && !service.includes('admin') && !service.includes('web'))
) {
  tryMigrate();
  run('node dist/apps/api/main.js');

} else if (service.includes('admin')) {
  startNextApp('admin', process.env['PORT'] || 3001);

} else if (
  service.includes('client') ||
  service.includes('web') ||
  service.includes('storefront')
) {
  startNextApp('client', process.env['PORT'] || 3000);
}
