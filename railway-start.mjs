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
  // Debug: find where server.js actually is
  console.log('[railway-start] Searching for server.js...');
  run('find . -name "server.js" -not -path "*/node_modules/*" 2>/dev/null | head -20 || true');
  run('ls dist/apps/admin/ 2>/dev/null || echo "dist/apps/admin/ not found"');
  run('ls dist/apps/admin/.next/ 2>/dev/null || echo "dist/apps/admin/.next/ not found"');
  run('ls apps/admin/.next/ 2>/dev/null || echo "apps/admin/.next/ not found"');

  const port = process.env['PORT'] || '3001';
  const candidates = [
    'dist/apps/admin/.next/standalone/server.js',
    'dist/apps/admin/server.js',
    'apps/admin/.next/standalone/server.js',
    'apps/admin/.next/standalone/apps/admin/server.js',
  ];
  const serverJs = candidates.find(existsSync);
  if (serverJs) {
    process.env['PORT'] = port;
    process.env['HOSTNAME'] = '0.0.0.0';
    run(`node ${serverJs}`);
  } else {
    // Fallback: rebuild and start
    console.warn('[railway-start] standalone not found, running next build + start');
    run('pnpm nx build admin --configuration=production');
    run('pnpm exec next start dist/apps/admin');
  }

} else if (service.includes('client') || service.includes('web') || service.includes('storefront')) {
  console.log('[railway-start] Searching for server.js...');
  run('find . -name "server.js" -not -path "*/node_modules/*" 2>/dev/null | head -20 || true');
  run('ls dist/apps/client/ 2>/dev/null || echo "dist/apps/client/ not found"');
  run('ls dist/apps/client/.next/ 2>/dev/null || echo "dist/apps/client/.next/ not found"');
  run('ls apps/client/.next/ 2>/dev/null || echo "apps/client/.next/ not found"');

  const port = process.env['PORT'] || '3000';
  const candidates = [
    'dist/apps/client/.next/standalone/server.js',
    'dist/apps/client/server.js',
    'apps/client/.next/standalone/server.js',
    'apps/client/.next/standalone/apps/client/server.js',
  ];
  const serverJs = candidates.find(existsSync);
  if (serverJs) {
    process.env['PORT'] = port;
    process.env['HOSTNAME'] = '0.0.0.0';
    run(`node ${serverJs}`);
  } else {
    console.warn('[railway-start] standalone not found, running next build + start');
    run('pnpm nx build client --configuration=production');
    run('pnpm exec next start dist/apps/client');
  }
}
