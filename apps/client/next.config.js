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
  compress: true,
  transpilePackages: ['@mlh/constants', '@mlh/types', '@mlh/ui', '@mlh/api-client'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.dailydaisy.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  experimental: {
    optimizePackageImports: [
      '@mlh/ui', 'lucide-react', 'recharts', '@tanstack/react-table', 'date-fns',
    ],
    turbopackUseSystemTlsCerts: true,
  },
};

const plugins = [withBundleAnalyzer, withNextIntl, withNx];

module.exports = composePlugins(...plugins)(nextConfig);
