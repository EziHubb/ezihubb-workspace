const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          dark:    'var(--c-primary-dark)',
          light:   'var(--c-primary-light)',
        },
        secondary: '#2D2D2D',
        background: '#FAFAF8',
        surface:    '#FFFFFF',
        border:     '#E8E4DF',
        muted:      '#6B6B6B',
        success:    '#2E7D52',
        warning:    '#D97706',
        error:      '#DC2626',
        // Order-status semantic colors
        status: {
          pending:     '#D97706',
          confirmed:   '#2563EB',
          production:  '#7C3AED',
          shipped:     '#0891B2',
          delivered:   '#059669',
          completed:   '#2E7D52',
          cancelled:   '#6B7280',
          refunded:    '#9CA3AF',
          disputed:    '#DC2626',
        },
        // Product badge colors
        badge: {
          bestseller: '#E85D3F',
          new:        '#7C3AED',
          sale:       '#DC2626',
          hot:        '#D97706',
        },
        // Accent "hero band" backgrounds — modal headers, promo hero cards
        // (Etsy reference: peach for Social Media hero, periwinkle for most
        // modal headers, purple for FAQ/CTA bands).
        hero: {
          peach:      '#FCE0CC',
          periwinkle: '#C7D2F0',
          purple:     '#E8E0F5',
        },
        // Pastel icon-circle badges used in grouped list/accordion rows
        // (e.g. Finances' Sales/Fees/Marketing category rows).
        category: {
          'sales-bg':     '#D7F2DE',
          'sales-fg':     '#2E7D52',
          'fees-bg':      '#FBE0E6',
          'fees-fg':      '#C2185B',
          'marketing-bg': '#EDE4FB',
          'marketing-fg': '#7C3AED',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm:  '8px',
        md:  '12px',
        lg:  '16px',
        xl:  '24px',
        // aliases for convenience
        button: '8px',
        input:  '8px',
        card:   '12px',
        modal:  '16px',
        pill:   '999px',
      },
      boxShadow: {
        floating:     '0 4px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.10)',
        modal:        '0 20px 60px rgba(0,0,0,0.15)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-down': {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:          'shimmer 1.5s infinite linear',
        'slide-up':       'slide-up 0.3s ease-out',
        'fade-in':        'fade-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
