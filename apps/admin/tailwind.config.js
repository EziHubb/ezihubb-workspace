const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
const uiTokens = require('../../libs/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: uiTokens.theme,
  plugins: [],
};
