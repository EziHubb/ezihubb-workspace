'use client';

import { useTranslations } from 'next-intl';

// ── Props ─────────────────────────────────────────────────────────────────────

type ProductType = 'apparel' | 'canvas' | 'drinkware' | 'other';

interface ShippingReturnsContentProps {
  processingDays: number;
  productType:    ProductType;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function row(icon: string, text: string, sub?: string) {
  return { icon, text, sub };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShippingReturnsContent({
  processingDays,
  productType,
}: ShippingReturnsContentProps) {
  const t = useTranslations('product.shippingReturns');
  const stdMin = processingDays + 5;
  const stdMax = processingDays + 10;
  const expMin = processingDays + 2;
  const expMax = processingDays + 3;

  const shippingRows = [
    row('⏱', t('productionTime', { days: processingDays }), t('productionSub')),
    row('🚚', t('standard'), t('standardSub')),
    row('⚡', t('express'), t('expressSub')),
    row('🌍', t('international'), t('internationalSub')),
    row('📅', t('standardTotal', { min: stdMin, max: stdMax })),
    row('📅', t('expressTotal', { min: expMin, max: expMax })),
  ];

  const returnRows = [
    row('↩', t('cancelWithin2h')),
    row('🎁', t('personalizedNoReturn')),
    row('🛡', t('defectiveReplacement')),
    row('📧', t('emailSupport')),
  ];

  // Product-type-specific notes
  const extraReturns: string[] = [];
  if (productType === 'apparel') {
    extraReturns.push(t('sizeExchanges'));
  } else if (productType === 'canvas') {
    extraReturns.push(t('damagedShipping'));
  } else if (productType === 'drinkware') {
    extraReturns.push(t('dishwasherSafe'));
  }

  return (
    <div className="space-y-6 text-sm text-secondary">

      {/* Production & Shipping */}
      <div>
        <h4 className="font-semibold text-secondary text-xs uppercase tracking-widest mb-3 border-b border-border pb-2">
          {t('productionAndShipping')}
        </h4>
        <ul className="space-y-2.5">
          {shippingRows.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-base leading-5 shrink-0" aria-hidden="true">
                {r.icon}
              </span>
              <div className="min-w-0">
                <p className="text-secondary leading-snug">{r.text}</p>
                {r.sub && <p className="text-muted text-xs mt-0.5">{r.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Returns & Cancellations */}
      <div>
        <h4 className="font-semibold text-secondary text-xs uppercase tracking-widest mb-3 border-b border-border pb-2">
          {t('returnsAndCancellations')}
        </h4>
        <ul className="space-y-2.5">
          {[...returnRows, ...extraReturns.map((text) => row('ℹ️', text))].map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-base leading-5 shrink-0" aria-hidden="true">
                {r.icon}
              </span>
              <p className="text-secondary leading-snug">{r.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
