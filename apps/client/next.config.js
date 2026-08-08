//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const createNextIntlPlugin = require('next-intl/plugin');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const path = require('path');

// Compute a CWD-relative path so it works whether Nx runs from repo root or apps/client
const intlConfigPath = './' + path.relative(
  process.cwd(),
  path.join(__dirname, 'src/i18n/request.ts')
).replace(/\\/g, '/');

const withNextIntl = createNextIntlPlugin(intlConfigPath);

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // NOT using output: 'standalone' — docker/Dockerfile's production stage
  // copies the full node_modules and runs `next start` (never got updated
  // to copy .next/standalone + run `node server.js`, the only way
  // standalone's node_modules pruning actually pays off). Running
  // `next start` against a `standalone`-configured build silently breaks
  // things `next start` doesn't expect from that mode — reproduced as
  // fetch() calls with `next: { revalidate }` in force-dynamic routes
  // (e.g. the mega-menu nav) silently returning nothing in production
  // while working fine in dev — so keep this off until the Dockerfile is
  // actually rewritten to run the standalone server.
  compress: true,
  transpilePackages: ['@ezihubb/constants', '@ezihubb/types', '@ezihubb/ui', '@ezihubb/api-client'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.ezihubb.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      '@ezihubb/ui', 'lucide-react', 'recharts', '@tanstack/react-table', 'date-fns',
    ],
    turbopackUseSystemTlsCerts: true,
  },
};

const plugins = [withBundleAnalyzer, withNextIntl, withNx];

module.exports = composePlugins(...plugins)(nextConfig);
