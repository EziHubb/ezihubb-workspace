//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const createNextIntlPlugin = require('next-intl/plugin');
const path = require('path');

// Compute a CWD-relative path so it works whether Nx runs from repo root or apps/client
const intlConfigPath = './' + path.relative(
  process.cwd(),
  path.join(__dirname, 'src/i18n/request.ts')
).replace(/\\/g, '/');

const withNextIntl = createNextIntlPlugin(intlConfigPath);

// Bundle analyzer — only active when ANALYZE=true
// Install first: pnpm add -D @next/bundle-analyzer
// Usage:        ANALYZE=true pnpm nx build client
let withBundleAnalyzer = (/** @type {object} */ cfg) => cfg;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env['ANALYZE'] === 'true',
  });
} catch {
  // @next/bundle-analyzer not installed — safe to ignore until needed
}

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  transpilePackages: ['@mlh/constants', '@mlh/types', '@mlh/ui', '@mlh/api-client'],
  images: {
    // AVIF/WebP negotiation reduces image payload by 30-50% vs JPEG (LCP improvement)
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'cdn.maplehandmade.com' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
    ],
  },
  experimental: {
    // Tree-shake @mlh/ui and lucide-react — only import icons/components that are used
    optimizePackageImports: ['@mlh/ui', 'lucide-react'],
  },
};

const plugins = [withBundleAnalyzer, withNextIntl, withNx];

module.exports = composePlugins(...plugins)(nextConfig);
