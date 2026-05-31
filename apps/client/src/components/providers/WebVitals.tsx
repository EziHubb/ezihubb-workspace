'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Invisible component that reports Core Web Vitals to your analytics provider.
 * Place inside the locale layout (already done).
 *
 * Replace the console.log with your analytics call:
 *   - Google Analytics 4: gtag('event', metric.name, { value: metric.delta })
 *   - Vercel Analytics: handled automatically by @vercel/analytics
 *   - Custom endpoint: fetch('/api/vitals', { body: JSON.stringify(metric) })
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      // Log to console in development for easy tuning
      const color =
        metric.rating === 'good'
          ? '\x1b[32m'   // green
          : metric.rating === 'needs-improvement'
            ? '\x1b[33m' // amber
            : '\x1b[31m'; // red
      // eslint-disable-next-line no-console
      console.log(
        `%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
        `color: ${color === '\x1b[32m' ? 'green' : color === '\x1b[33m' ? 'orange' : 'red'}`,
      );
    }

    // Production: send to analytics
    // Uncomment and adapt to your analytics provider:
    //
    // if (typeof window !== 'undefined' && window.gtag) {
    //   window.gtag('event', metric.name, {
    //     value:          Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    //     event_category: metric.label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    //     event_label:    metric.id,
    //     non_interaction: true,
    //   });
    // }
  });

  return null;
}
