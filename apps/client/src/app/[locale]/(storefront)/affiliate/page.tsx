import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';

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

export default async function AffiliateLandingPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'affiliate' });

  const FAQ = [
    { q: t('landing.faqQ1'), a: t('landing.faqA1') },
    { q: t('landing.faqQ2'), a: t('landing.faqA2') },
    { q: t('landing.faqQ3'), a: t('landing.faqA3') },
    { q: t('landing.faqQ4'), a: t('landing.faqA4') },
  ];

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
            {t('landing.badge')}
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-secondary leading-tight mb-6">
            {t('landing.heroTitleLine1', { percent: commissionPct })}<br className="hidden md:block" /> {t('landing.heroTitleLine2')}
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-3">
            {t('landing.heroSubtitle', { percent: discountPct })}
          </p>
          <p className="text-sm text-muted mb-10">
            {t('landing.heroNote')}
          </p>
          <Link
            href="./affiliate/register"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-base px-8 py-4 rounded-button transition-colors uppercase tracking-wide"
          >
            {t('landing.applyNow')}
          </Link>
          <p className="mt-4 text-xs text-muted">
            {t('landing.approvedWithin')}
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <h2 className="font-display text-3xl font-bold text-secondary text-center mb-12">
          {t('landing.howItWorksTitle')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: t('landing.step1Title'),
              body:  t('landing.step1Body'),
            },
            {
              step: '02',
              title: t('landing.step2Title'),
              body:  t('landing.step2Body', { days: cookieDays }),
            },
            {
              step: '03',
              title: t('landing.step3Title'),
              body:  t('landing.step3Body', { days: lockDays }),
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
              { value: `${commissionPct}%`,                                 label: t('landing.statCommissionLabel') },
              { value: t('landing.statDiscountValue', { percent: discountPct }), label: t('landing.statDiscountLabel') },
              { value: t('landing.statCookieValue', { days: cookieDays }),   label: t('landing.statCookieLabel') },
              { value: t('landing.statPayoutValue', { amount: fmtAmount(minPayout) }), label: t('landing.statPayoutLabel') },
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
          {t('landing.faqTitle')}
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
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-muted mb-8">
            {t('landing.ctaBody')}
          </p>
          <Link
            href="./affiliate/register"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-base px-8 py-4 rounded-button transition-colors uppercase tracking-wide"
          >
            {t('landing.applyNowShort')}
          </Link>
        </div>
      </section>
    </div>
  );
}
