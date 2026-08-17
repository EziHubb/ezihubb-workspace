//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // See apps/client/next.config.js for why this requires docker/Dockerfile
  // to run `node server.js` from .next/standalone — not `next start`.
  output: 'standalone',
  transpilePackages: ['@ezihubb/constants', '@ezihubb/types', '@ezihubb/ui', '@ezihubb/api-client'],
  experimental: {
    optimizePackageImports: ['recharts', '@tanstack/react-table'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
