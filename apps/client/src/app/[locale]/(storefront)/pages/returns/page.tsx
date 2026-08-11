import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ShieldCheck, RefreshCw, CreditCard,
  CheckCircle2, XCircle, ArrowLeftRight,
  Package, Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Returns & Exchanges',
    description:
      "Our return and exchange policy. Learn what's covered, how to initiate a return, and how we make things right.",
    robots: { index: true, follow: true },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface CoverageItem {
  covered: boolean;
  title:   string;
  desc:    string;
}

export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.returns' });

  const POLICY_CARDS: {
    Icon:      LucideIcon;
    iconCls:   string;
    bgCls:     string;
    title:     string;
    desc:      string;
  }[] = [
    {
      Icon:    ShieldCheck,
      iconCls: 'text-green-600',
      bgCls:   'bg-green-50',
      title:   t('policyCards.protection.title'),
      desc:    t('policyCards.protection.desc'),
    },
    {
      Icon:    RefreshCw,
      iconCls: 'text-blue-600',
      bgCls:   'bg-blue-50',
      title:   t('policyCards.replacements.title'),
      desc:    t('policyCards.replacements.desc'),
    },
    {
      Icon:    CreditCard,
      iconCls: 'text-purple-600',
      bgCls:   'bg-purple-50',
      title:   t('policyCards.refunds.title'),
      desc:    t('policyCards.refunds.desc'),
    },
  ];

  const COVERAGE_ITEMS: CoverageItem[] = [
    { covered: true,  title: t('coverage.items.defective.title'),            desc: t('coverage.items.defective.desc')            },
    { covered: true,  title: t('coverage.items.wrongPersonalization.title'), desc: t('coverage.items.wrongPersonalization.desc') },
    { covered: true,  title: t('coverage.items.different.title'),            desc: t('coverage.items.different.desc')            },
    { covered: true,  title: t('coverage.items.lost.title'),                 desc: t('coverage.items.lost.desc')                 },
    { covered: false, title: t('coverage.items.typos.title'),                desc: t('coverage.items.typos.desc')                },
    { covered: false, title: t('coverage.items.changedMind.title'),          desc: t('coverage.items.changedMind.desc')          },
    { covered: false, title: t('coverage.items.colorVariation.title'),       desc: t('coverage.items.colorVariation.desc')       },
  ];

  const RESOLUTION_STEPS = [
    { step: '1', title: t('resolution.steps.contact.title'), desc: t('resolution.steps.contact.desc') },
    { step: '2', title: t('resolution.steps.photo.title'),   desc: t('resolution.steps.photo.desc')   },
    { step: '3', title: t('resolution.steps.resolve.title'), desc: t('resolution.steps.resolve.desc') },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
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

      {/* ── Policy summary cards ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-5 mb-14">
        {POLICY_CARDS.map(({ Icon, iconCls, bgCls, title, desc }) => (
          <div key={title} className="text-center p-6 border border-border rounded-2xl">
            <div className={`w-12 h-12 ${bgCls} rounded-xl flex items-center justify-center mx-auto mb-3`}>
              <Icon className={`w-5 h-5 ${iconCls}`} />
            </div>
            <p className="font-semibold text-secondary mb-1">{title}</p>
            <p className="text-sm text-muted">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── What's covered ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('coverage.title')}</h2>
        <div className="space-y-4">
          {COVERAGE_ITEMS.map(({ covered, title, desc }) => (
            <div
              key={title}
              className={`flex gap-4 p-5 rounded-2xl border ${
                covered
                  ? 'border-green-100 bg-green-50/50'
                  : 'border-[#F3F4F6] bg-[#FAFAF8]'
              }`}
            >
              {covered
                ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                : <XCircle     className="w-5 h-5 text-muted     shrink-0 mt-0.5" />
              }
              <div>
                <p className="font-medium text-secondary text-sm">{title}</p>
                <p className="text-sm text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How to get a resolution ───────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('resolution.title')}</h2>
        <div className="space-y-4">
          {RESOLUTION_STEPS.map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5">
                {step}
              </div>
              <div>
                <p className="font-semibold text-secondary">{title}</p>
                <p className="text-sm text-muted mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cancellations ────────────────────────────────────────────────── */}
      <section className="mb-14 bg-[#FAFAF8] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-secondary mb-4">{t('cancellations.title')}</h2>
        <p className="text-muted leading-relaxed mb-4">
          {t.rich('cancellations.p1', { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
        <p className="text-muted leading-relaxed mb-5">
          {t.rich('cancellations.p2', { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Package className="w-4 h-4" />
            {t('cancellations.viewOrders')}
          </Link>
          <Link
            href="/pages/contact"
            className="inline-flex items-center gap-2 border border-border text-secondary px-5 py-2.5 rounded-full text-sm font-medium hover:border-primary hover:text-primary transition-colors"
          >
            <Mail className="w-4 h-4" />
            {t('cancellations.contactUs')}
          </Link>
        </div>
      </section>

      {/* ── Exchanges note ────────────────────────────────────────────────── */}
      <section className="text-center border border-border rounded-2xl p-8">
        <ArrowLeftRight className="w-8 h-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-bold text-secondary mb-2">{t('exchanges.title')}</h2>
        <p className="text-muted max-w-lg mx-auto mb-4">
          {t('exchanges.desc')}
        </p>
        <Link href="/pages/contact" className="text-primary text-sm hover:underline">
          {t('exchanges.link')}
        </Link>
      </section>
    </div>
  );
}
