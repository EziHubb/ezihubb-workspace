//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // NOT using output: 'standalone' — see apps/client/next.config.js for
  // why: docker/Dockerfile's production stage runs `next start` against
  // the full build output, never updated to run the standalone server,
  // and that mismatch silently breaks fetch() + { next: { revalidate } }
  // in force-dynamic routes in production (confirmed on the client app).
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
