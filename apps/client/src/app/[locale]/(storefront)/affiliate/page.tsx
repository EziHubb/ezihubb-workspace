import Link from 'next/link';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

// Settings are fetched server-side and cached at the data level.
// The storefront layout is force-dynamic, but the fetch itself
// revalidates every hour so numbers stay accurate without per-request hits.

interface AffiliateSettings {
  defaultRate:      number;
  buyerDiscountRate: number;
  cookieDays:       number;
  minPayoutAmount:  number;
  lockDays:         number;
  isEnabled:        boolean;
}

const FAQ = [
  {
    q: 'When do I get paid?',
    a: 'Commissions are locked for 14 days after the order is delivered (to cover the return window), then moved to your available balance. You can request a payout any time once your balance reaches the minimum threshold.',
  },
  {
    q: 'How long does the referral cookie last?',
    a: 'The cookie is set for 30 days from the visitor\'s first click. If they return and click another affiliate link, the most recent click gets credit.',
  },
  {
    q: 'Can buyers also use a coupon code?',
    a: 'Yes — coupon codes stack with the referral discount. Buyers get both savings; your commission is calculated on the subtotal after coupon discounts only.',
  },
  {
    q: 'What counts as a valid sale?',
    a: 'Any paid order placed within the cookie window counts. Refunded or chargebacked orders will have their commission cancelled automatically.',
  },
];

export default async function AffiliateLandingPage() {
  const settings = await apiClient
    .get<AffiliateSettings>(API_ROUTES.AFFILIATES.SETTINGS_PUBLIC, {
      next: { revalidate: 3600 },
    })
    .catch(() => null);

  const commissionPct = Math.round((settings?.defaultRate ?? 0.1) * 100);
  const discountPct   = Math.round((settings?.buyerDiscountRate ?? 0.05) * 100);
  const cookieDays    = settings?.cookieDays ?? 30;
  const minPayout     = settings?.minPayoutAmount ?? 50;
  const lockDays      = settings?.lockDays ?? 14;

  return (
    <div className="bg-background">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
          <span className="inline-block bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            Affiliate Program
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-secondary leading-tight mb-6">
            Earn {commissionPct}% on every sale<br className="hidden md:block" /> you refer
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-3">
            Share your unique link. Your audience saves {discountPct}% on every order.
            You earn commission. Everyone wins.
          </p>
          <p className="text-sm text-muted mb-10">
            No monthly fees · No minimums to join · Paid manually
          </p>
          <Link
            href="./affiliate/register"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-base px-8 py-4 rounded-button transition-colors uppercase tracking-wide"
          >
            Apply Now — it&apos;s free
          </Link>
          <p className="mt-4 text-xs text-muted">
            Usually approved within 24 hours
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-secondary text-center mb-12">
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Apply',
              body:  'Fill out a short form. Tell us about your audience and content style. We\'ll review and respond within 24 hours.',
            },
            {
              step: '02',
              title: 'Share your link',
              body:  `You get a unique referral URL that tracks clicks for ${cookieDays} days. Drop it anywhere — social, blog, email, video description.`,
            },
            {
              step: '03',
              title: 'Earn commission',
              body:  `Commission is locked for ${lockDays} days after delivery. Once confirmed, it moves to your balance and you can request a payout.`,
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="relative">
              <span className="text-5xl font-display font-bold text-primary/15 leading-none select-none">
                {step}
              </span>
              <h3 className="font-display text-xl font-bold text-secondary mt-2 mb-3">
                {title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── NUMBERS ROW ───────────────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: `${commissionPct}%`,        label: 'Your commission' },
              { value: `${discountPct}% off`,      label: 'Buyer discount' },
              { value: `${cookieDays}-day cookie`, label: 'Attribution window' },
              { value: `$${minPayout} min`,        label: 'Payout threshold' },
            ].map(({ value, label }) => (
              <div key={label}>
                <dt className="font-display text-3xl font-bold text-primary">{value}</dt>
                <dd className="text-sm text-muted mt-1">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-secondary text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group border border-border rounded-card overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-surface transition-colors">
                <span className="font-medium text-secondary text-sm">{q}</span>
                {/* chevron rotates on open */}
                <svg
                  className="w-4 h-4 text-muted shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-5 pt-1 text-sm text-muted leading-relaxed border-t border-border">
                {a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────────── */}
      <section className="bg-primary/5 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-16 text-center">
          <h2 className="font-display text-3xl font-bold text-secondary mb-4">
            Ready to start earning?
          </h2>
          <p className="text-muted mb-8">
            Join other creators already earning with Maple Loom Handmade.
          </p>
          <Link
            href="./affiliate/register"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-base px-8 py-4 rounded-button transition-colors uppercase tracking-wide"
          >
            Apply Now
          </Link>
        </div>
      </section>
    </div>
  );
}
