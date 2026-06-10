'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { trackWebVital } from '../../lib/analytics/ga4';

export function WebVitals() {
  useReportWebVitals((metric) => {
    trackWebVital(metric);
  });

  return null;
}
