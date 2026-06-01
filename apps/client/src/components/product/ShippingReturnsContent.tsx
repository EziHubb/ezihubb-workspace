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
  const stdMin = processingDays + 5;
  const stdMax = processingDays + 10;
  const expMin = processingDays + 2;
  const expMax = processingDays + 3;

  const shippingRows = [
    row('⏱', `Production time: ${processingDays} business days`, 'Your item is made to order after purchase'),
    row('🚚', 'Standard (US): 5–10 business days', 'FREE on orders over $50'),
    row('⚡', 'Express (US): 2–3 business days', '$14.99'),
    row('🌍', 'International: 14–21 business days', 'From $19.99'),
    row('📅', `Standard total: ${stdMin}–${stdMax} business days`),
    row('📅', `Express total: ${expMin}–${expMax} business days`),
  ];

  const returnRows = [
    row('↩', 'Cancel within 2 hours of ordering'),
    row('🎁', 'Personalized items cannot be returned unless defective'),
    row('🛡', 'Defective items: contact us within 30 days for replacement'),
    row('📧', 'Issues? Email support@mapleloomhandmade.com'),
  ];

  // Product-type-specific notes
  const extraReturns: string[] = [];
  if (productType === 'apparel') {
    extraReturns.push('Size exchanges: if unworn and unwashed, within 14 days');
  } else if (productType === 'canvas') {
    extraReturns.push('Damaged in shipping: photo required within 72 hours');
  } else if (productType === 'drinkware') {
    extraReturns.push('Dishwasher safe — top rack recommended for longevity');
  }

  return (
    <div className="space-y-6 text-sm text-secondary">

      {/* Production & Shipping */}
      <div>
        <h4 className="font-semibold text-secondary text-xs uppercase tracking-widest mb-3 border-b border-border pb-2">
          Production &amp; Shipping
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
          Returns &amp; Cancellations
        </h4>
        <ul className="space-y-2.5">
          {[...returnRows, ...extraReturns.map((t) => row('ℹ️', t))].map((r, i) => (
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
