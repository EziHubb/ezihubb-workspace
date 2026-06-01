const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    join(__dirname, '../../libs/ui/src/**/*.{ts,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E85D3F',
          dark:    '#C44A2E',
          light:   '#FFF0EC',
        },
        sidebar:          '#1E1E2E',
        'sidebar-active': 'rgba(232,93,63,0.12)',
        background:       '#F5F5F7',
        surface:          '#FFFFFF',
        border:           '#E8E4DF',
        muted:            '#6B6B6B',
        secondary:        '#2D2D2D',
        success:          '#22C55E',
        warning:          '#F59E0B',
        error:            '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:   '12px',
        button: '8px',
        pill:   '9999px',
      },
      boxShadow: {
        floating: '0 4px 24px rgba(0,0,0,0.08)',
        card:     '0 1px 3px rgba(0,0,0,0.05)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0'  },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        fadeIn:  'fadeIn 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
