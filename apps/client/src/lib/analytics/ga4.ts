const GA_ID = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];

export function trackWebVital(metric: {
  name:   string;
  value:  number;
  id:     string;
  rating: string;
}): void {
  if (typeof window === 'undefined' || !window.gtag || !GA_ID) return;
  window.gtag('event', metric.name, {
    value:             Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_category:    'Web Vitals',
    event_label:       metric.id,
    metric_rating:     metric.rating,
    non_interaction:   true,
  });
}
