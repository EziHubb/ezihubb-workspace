//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // Traces the actual import graph and copies only the node_modules this
  // app really uses into .next/standalone — instead of shipping the whole
  // pnpm-workspace node_modules (which also carries client's and api's
  // deps) into the production Docker image. See docker/Dockerfile.
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
