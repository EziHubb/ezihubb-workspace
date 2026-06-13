import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// SERVICE is injected as a Docker build ARG from railway.toml (SERVICE = RAILWAY_SERVICE_NAME).
// Build only the service being deployed to avoid spending 20+ min building all three apps.
const service = (process.env.SERVICE ?? '').toLowerCase();
const buildAll = !service;

console.log(`[railway-build] SERVICE="${service || 'all'}" — building accordingly...`);

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

const prisma = 'node node_modules/prisma/build/index.js';
const nx     = 'node node_modules/nx/dist/bin/nx.js';

run(`${prisma} generate --schema=prisma/schema.prisma`);

if (buildAll || service.includes('api')) {
  run(`${nx} build api --configuration=production`);
}
if (buildAll || service.includes('client') || service.includes('web') || service.includes('storefront')) {
  // Limit SSG workers — Railway's build environment OOMs at the default 31 workers
  process.env.NEXT_PRIVATE_CPUS = '2';
  run(`${nx} build client --configuration=production`);
}
if (buildAll || service.includes('admin')) {
  process.env.NEXT_PRIVATE_CPUS = '2';
  run(`${nx} build admin --configuration=production`);
}

// The Nx-generated next.config.js in dist/ loads .nx-helpers/with-nx.js which has a
// top-level require('semver') — a devDependency that can't resolve from dist/.
// Replace both with minimal production-only configs that skip the Nx wrappers entirely.
// At PHASE_PRODUCTION_SERVER, withNx/withNextIntl/withBundleAnalyzer are all no-ops
// anyway: withNx just returns { distDir: '.next', ...rest }.

if (buildAll || service.includes('admin')) {
  writeFileSync('dist/apps/admin/next.config.js', `/** @type {import('next').NextConfig} */
module.exports = {
  distDir: '.next',
  transpilePackages: ['@mlh/constants', '@mlh/types', '@mlh/ui', '@mlh/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
  experimental: {
    optimizePackageImports: ['recharts', '@tanstack/react-table'],
  },
};
`);
}

if (buildAll || service.includes('client') || service.includes('web') || service.includes('storefront')) {
  writeFileSync('dist/apps/client/next.config.js', `/** @type {import('next').NextConfig} */
module.exports = {
  distDir: '.next',
  compress: true,
  transpilePackages: ['@mlh/constants', '@mlh/types', '@mlh/ui', '@mlh/api-client'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: ${60 * 60 * 24 * 30},
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.dailydaisy.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      '@mlh/ui', 'lucide-react', 'recharts', '@tanstack/react-table', 'date-fns',
    ],
  },
};
`);
}

console.log('[railway-build] next.config.js patched for production.');
console.log('[railway-build] Done.');
