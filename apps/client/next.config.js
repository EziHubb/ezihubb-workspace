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

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  output: 'standalone',
  transpilePackages: ['@mlh/constants', '@mlh/types', '@mlh/ui', '@mlh/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'cdn.mapleloomhandmade.com' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
    ],
  },
};

const plugins = [withNextIntl, withNx];

module.exports = composePlugins(...plugins)(nextConfig);
