// Hotjar behavioral analytics — wrapper around window.hj API.
// The CDN script is injected by layout.tsx <Script strategy="afterInteractive">.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    hj: ((...args: any[]) => void) & { q?: any[][] };
    _hjSettings: { hjid: number; hjsv: number };
  }
}

// Programmatic init — alternative to the layout.tsx inline snippet.
// Use this when gating Hotjar behind cookie consent.
export function initHotjar(siteId: number): void {
  if (typeof window === 'undefined') return;
  if (!window.hj) {
    function hj(...args: any[]) { (hj.q = hj.q || []).push(args); }
    hj.q = [] as any[][];
    window.hj = hj;
  }
  window._hjSettings = { hjid: siteId, hjsv: 6 };
  const head   = document.getElementsByTagName('head')[0];
  const script = document.createElement('script');
  script.async = true;
  script.src   = `https://static.hotjar.com/c/hotjar-${siteId}.js?sv=6`;
  head.appendChild(script);
}

// Link the current session to a known user.
// Attributes must not contain PII beyond what Hotjar is approved for.
export function identifyHotjarUser(
  userId: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined' || typeof window.hj === 'undefined') return;
  window.hj('identify', userId, attributes ?? {});
}

// Fire a named custom event for funnel / heatmap segmentation.
export function hotjarEvent(eventName: string): void {
  if (typeof window === 'undefined' || typeof window.hj === 'undefined') return;
  window.hj('event', eventName);
}

// Trigger a Hotjar feedback widget by its configured trigger name.
export function triggerFeedback(feedbackId: string): void {
  if (typeof window === 'undefined' || typeof window.hj === 'undefined') return;
  window.hj('trigger', feedbackId);
}
