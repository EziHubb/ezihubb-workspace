const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
const uiTokens = require('../../libs/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    join(__dirname, '../../libs/ui/src/**/*.{ts,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  // Single source of truth is libs/ui's theme (same pattern apps/client already
  // uses) — admin previously hand-duplicated tokens and drifted (wrong bg hex,
  // missing status/badge scales, `fadeIn` vs `fade-in` naming split). Only
  // admin-specific additions (sidebar active-state tint) are layered on top.
  theme: {
    ...uiTokens.theme,
    extend: {
      ...uiTokens.theme.extend,
      colors: {
        ...uiTokens.theme.extend.colors,
        // Etsy's sidebar itself is always the same cream as the page
        // background — only the active-nav-item tint varies with the
        // seller's chosen admin accent color.
        'sidebar-active': 'rgb(var(--c-primary) / 0.10)',
      },
    },
  },
  plugins: [],
};
