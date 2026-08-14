import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CreditCard, Wallet, ShieldCheck, Globe2, CalendarClock, Send, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'EziHubb Payments',
    description:
      'Simple, flexible, secure payments for EziHubb sellers — preferred payment methods for buyers, fast deposits, and EziHubb Purchase Protection.',
    robots: { index: true, follow: true },
  };
}

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Apple Pay', 'Google Pay', 'PayPal'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.payments' });

  const BENEFITS: { Icon: LucideIcon; title: string; desc: string }[] = [
    { Icon: CreditCard,  title: t('benefits.items.methods.title'),  desc: t('benefits.items.methods.desc')  },
    { Icon: Wallet,      title: t('benefits.items.finances.title'), desc: t('benefits.items.finances.desc') },
    { Icon: ShieldCheck, title: t('benefits.items.protection.title'), desc: t('benefits.items.protection.desc') },
  ];

  const STEPS: { step: string; Icon: LucideIcon; title: string; desc: string }[] = [
    { step: '1', Icon: CalendarClock, title: t('howItWorks.steps.schedule.title'), desc: t('howItWorks.steps.schedule.desc') },
    { step: '2', Icon: Send,          title: t('howItWorks.steps.processed.title'), desc: t('howItWorks.steps.processed.desc') },
    { step: '3', Icon: Landmark,      title: t('howItWorks.steps.deposited.title'), desc: t('howItWorks.steps.deposited.desc') },
  ];

  const FAQS = [
    { q: t('faqs.items.why.q'),       a: t('faqs.items.why.a')       },
    { q: t('faqs.items.howToAdd.q'),  a: t('faqs.items.howToAdd.a')  },
    { q: t('faqs.items.fees.q'),      a: t('faqs.items.fees.a')      },
    { q: t('faqs.items.countries.q'), a: t('faqs.items.countries.a') },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          {t('title')}
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* ── Payment method badges ────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mb-14">
        {PAYMENT_METHODS.map((name) => (
          <span key={name} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-button text-xs text-secondary bg-[#FAFAF8]">
            <CreditCard className="w-3.5 h-3.5 text-muted" /> {name}
          </span>
        ))}
      </div>

      {/* ── Benefits ──────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <div className="grid sm:grid-cols-3 gap-6">
          {BENEFITS.map(({ Icon, title, desc }) => (
            <div key={title} className="p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stat + deposit currency ──────────────────────────────────────── */}
      <section className="grid sm:grid-cols-2 gap-4 mb-14">
        <div className="flex items-start gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <Globe2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-secondary">{t('depositCurrency.title')}</p>
            <p className="text-sm text-muted mt-1">{t('depositCurrency.desc')}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 bg-[#FAFAF8] border border-border rounded-2xl p-5">
          <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-secondary">{t('salesLift.title')}</p>
            <p className="text-sm text-muted mt-1">{t('salesLift.desc')}</p>
          </div>
        </div>
      </section>

      {/* ── Fees ──────────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-3">{t('fees.title')}</h2>
        <p className="text-muted mb-2">{t('fees.desc')}</p>
        <p className="text-xs text-muted">{t('fees.footnote')}</p>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('howItWorks.title')}</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted mb-1">{t('howItWorks.stepLabel', { step })}</p>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-8 mb-14">
        <h2 className="text-xl font-bold text-secondary mb-6">{t('faqs.title')}</h2>
        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-secondary text-sm">{q}</p>
              <p className="text-sm text-muted mt-1">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="text-center">
        <h2 className="text-xl font-bold text-secondary mb-2">{t('cta.title')}</h2>
        <p className="text-sm text-muted mb-5">{t('cta.subtitle')}</p>
        <Link
          href="/open-shop"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
        >
          {t('cta.button')}
        </Link>
      </section>
    </div>
  );
}
