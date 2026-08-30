//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

const isDevelopment = process.env.NODE_ENV === 'development';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

function configuredCdnPattern() {
  const value = process.env.NEXT_PUBLIC_CDN_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(isDevelopment && url.protocol === 'http:')) return null;
    return new URL(`${url.origin}/**`);
  } catch {
    return null;
  }
}

const cdnPattern = configuredCdnPattern();

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // See apps/client/next.config.js for why this requires docker/Dockerfile
  // to run `node server.js` from .next/standalone — not `next start`.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: ['@ezihubb/constants', '@ezihubb/types', '@ezihubb/ui', '@ezihubb/api-client'],
  experimental: {
    optimizePackageImports: ['recharts', '@tanstack/react-table'],
  },
  images: {
    remotePatterns: [
      new URL('https://cdn.ezihubb.com/**'),
      new URL('https://s3.amazonaws.com/**'),
      new URL('https://*.r2.dev/**'),
      new URL('https://lh3.googleusercontent.com/**'),
      ...(cdnPattern ? [cdnPattern] : []),
      ...(isDevelopment ? [new URL('http://localhost/**')] : []),
    ],
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
