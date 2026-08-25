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
  // Requires docker/Dockerfile's production stage to run `node server.js`
  // from .next/standalone — NOT `next start` (see git history: running
  // `next start` against a standalone-configured build silently broke
  // fetch() + { next: { revalidate } } in force-dynamic routes, e.g. the
  // mega-menu nav, and was reverted). The Dockerfile below has been
  // updated accordingly — verify the mega-menu nav specifically after any
  // future change here before trusting it in production.
  output: 'standalone',
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
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google account avatars
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      '@ezihubb/ui', 'lucide-react', 'recharts', '@tanstack/react-table', 'date-fns',
    ],
    // `turbopackUseSystemTlsCerts` lived here until Next 16.2 removed it.
    // It was a dev-time convenience for Turbopack behind a TLS-intercepting
    // proxy and never affected a production build; the replacement, if it is
    // ever needed again, is the standard NODE_EXTRA_CA_CERTS env var.
  },
};

const plugins = [withBundleAnalyzer, withNextIntl, withNx];

module.exports = composePlugins(...plugins)(nextConfig);
