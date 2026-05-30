//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const createNextIntlPlugin = require('next-intl/plugin');
const path = require('path');

const withNextIntl = createNextIntlPlugin(path.join(__dirname, 'src/i18n/request.ts'));

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  output: 'standalone',
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
