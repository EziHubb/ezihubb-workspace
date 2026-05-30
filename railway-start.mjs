import { execSync }                   from 'child_process';
import { existsSync, mkdirSync, cpSync } from 'fs';

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

/**
 * Copy a directory tree using Node.js fs APIs.
 * More reliable than shell cp/mkdir in Railway containers where
 * execSync can fail silently on restricted filesystems.
 */
function copyDir(src, dest) {
  if (!existsSync(src)) {
    console.log(`[railway-start] skip copy (src not found): ${src}`);
    return;
  }
  if (existsSync(dest)) {
    console.log(`[railway-start] skip copy (dest exists): ${dest}`);
    return;
  }
  try {
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`[railway-start] copied: ${src} → ${dest}`);
  } catch (err) {
    // Non-fatal: server can still start without static files being co-located
    console.warn(`[railway-start] copy failed (non-fatal): ${err.message}`);
  }
}

function startNextApp(appName, port) {
  // Nx monorepo standalone path:
  //   dist/apps/<name>/.next/standalone/apps/<name>/server.js
  const serverJs = `dist/apps/${appName}/.next/standalone/apps/${appName}/server.js`;

  if (!existsSync(serverJs)) {
    console.error(`[railway-start] server.js not found at ${serverJs}`);
    console.error('[railway-start] Run: pnpm nx build ' + appName + ' --configuration=production');
    process.exit(1);
  }

  // Next.js standalone requires static assets and public/ copied next to server.js.
  // Using Node.js fs.cpSync instead of shell cp/mkdir for Railway container reliability.
  copyDir(
    `dist/apps/${appName}/.next/static`,
    `dist/apps/${appName}/.next/standalone/apps/${appName}/.next/static`,
  );
  copyDir(
    `dist/apps/${appName}/public`,
    `dist/apps/${appName}/.next/standalone/apps/${appName}/public`,
  );

  // Copy next-intl messages so the standalone server can resolve translations
  copyDir(
    `apps/${appName}/messages`,
    `dist/apps/${appName}/.next/standalone/apps/${appName}/messages`,
  );

  process.env['PORT']     = String(port);
  process.env['HOSTNAME'] = '0.0.0.0';
  console.log(`[railway-start] Starting ${appName} on port ${port} via ${serverJs}`);
  run(`node ${serverJs}`);
}

// ── Service dispatch ──────────────────────────────────────────────────────────

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
