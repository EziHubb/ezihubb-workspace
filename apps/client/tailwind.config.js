const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
const uiTokens = require('../../libs/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    // Match admin: shared UI utilities must be included even when Nx's
    // dependency glob discovery is unavailable in the Next/Tailwind process.
    join(__dirname, '../../libs/ui/src/**/*.{ts,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: uiTokens.theme,
  plugins: [],
};
