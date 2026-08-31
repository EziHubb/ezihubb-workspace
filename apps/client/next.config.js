//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const createNextIntlPlugin = require('next-intl/plugin');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const path = require('path');

const isDevelopment = process.env.NODE_ENV === 'development';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://static.hotjar.com https://script.hotjar.com https://connect.facebook.net https://s.pinimg.com https://ct.pinterest.com https://static.cloudflareinsights.com https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://accounts.google.com https://www.googletagmanager.com https://vars.hotjar.com https://ct.pinterest.com https://js.stripe.com https://hooks.stripe.com https://www.paypal.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.paypal.com",
  "frame-ancestors 'self'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

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
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: ['@ezihubb/constants', '@ezihubb/types', '@ezihubb/ui', '@ezihubb/api-client'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
