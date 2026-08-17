import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Info, Package, Wrench, Truck, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildAlternates } from '../../../../../lib/seo';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Shipping Information',
    description:
      'Learn about our shipping rates, delivery times, tracking, and international shipping at EziHubb.',
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/shipping-info', locale),
  };
}

// ── Reusable table ────────────────────────────────────────────────────────────

function ShippingTable({
  headers,
  rows,
}: {
  headers: string[];
  rows:     string[][];
}) {
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] border-b border-border">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-5 py-3.5 font-semibold text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row[0]} className="hover:bg-[#FAFAF8] transition-colors">
              <td className="px-5 py-4 font-medium text-secondary">{row[0]}</td>
              <td className="px-5 py-4 text-muted">{row[1]}</td>
              <td className="px-5 py-4 text-muted">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ShippingInfoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.shippingInfo' });

  const DOMESTIC_RATES = [
    { method: t('domestic.rows.standard.method'),  time: t('domestic.rows.standard.time'),  cost: t('domestic.rows.standard.cost')  },
    { method: t('domestic.rows.express.method'),   time: t('domestic.rows.express.time'),   cost: t('domestic.rows.express.cost')   },
    { method: t('domestic.rows.overnight.method'), time: t('domestic.rows.overnight.time'), cost: t('domestic.rows.overnight.cost') },
  ];

  const INTERNATIONAL_RATES = [
    { region: t('international.rows.canada.region'), time: t('international.rows.canada.time'), cost: t('international.rows.canada.cost') },
    { region: t('international.rows.uk.region'),      time: t('international.rows.uk.time'),      cost: t('international.rows.uk.cost')      },
    { region: t('international.rows.eu.region'),      time: t('international.rows.eu.time'),      cost: t('international.rows.eu.cost')      },
    { region: t('international.rows.anz.region'),     time: t('international.rows.anz.time'),     cost: t('international.rows.anz.cost')     },
    { region: t('international.rows.sea.region'),     time: t('international.rows.sea.time'),     cost: t('international.rows.sea.cost')     },
    { region: t('international.rows.row.region'),     time: t('international.rows.row.time'),     cost: t('international.rows.row.cost')     },
  ];

  const TRACKING_STEPS: { step: string; Icon: LucideIcon; title: string; desc: string }[] = [
    { step: '1', Icon: Package, title: t('tracking.steps.confirmed.title'),  desc: t('tracking.steps.confirmed.desc')  },
    { step: '2', Icon: Wrench,  title: t('tracking.steps.production.title'), desc: t('tracking.steps.production.desc') },
    { step: '3', Icon: Truck,   title: t('tracking.steps.shipped.title'),    desc: t('tracking.steps.shipped.desc')    },
  ];

  const SHIPPING_FAQS = [
    { q: t('faqs.items.lost.q'),    a: t('faqs.items.lost.a')    },
    { q: t('faqs.items.address.q'), a: t('faqs.items.address.a') },
    { q: t('faqs.items.poBox.q'),   a: t('faqs.items.poBox.a')   },
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

      {/* ── Production time notice ────────────────────────────────────────── */}
      <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-12">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-secondary">{t('productionNotice.title')}</p>
          <p className="text-sm text-muted mt-1">
            {t('productionNotice.desc')}
          </p>
        </div>
      </div>

      {/* ── Domestic rates ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">
          {t('domestic.title')}
        </h2>
        <ShippingTable
          headers={[t('domestic.headers.method'), t('domestic.headers.time'), t('domestic.headers.cost')]}
          rows={DOMESTIC_RATES.map((r) => [r.method, r.time, r.cost])}
        />
        <p className="text-xs text-muted mt-3">
          {t('domestic.footnote')}
        </p>
      </section>

      {/* ── International rates ───────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('international.title')}</h2>
        <ShippingTable
          headers={[t('international.headers.region'), t('international.headers.time'), t('international.headers.cost')]}
          rows={INTERNATIONAL_RATES.map((r) => [r.region, r.time, r.cost])}
        />
        <div className="mt-3 p-4 bg-[#FAFAF8] rounded-xl text-sm text-muted space-y-1">
          <p>{t('international.note1')}</p>
          <p>{t('international.note2')}</p>
          <p>{t('international.note3')}</p>
        </div>
      </section>

      {/* ── Tracking steps ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('tracking.title')}</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {TRACKING_STEPS.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted mb-1">{t('tracking.stepLabel', { step })}</p>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href={`/${locale}/orders/track`}
            className="inline-flex items-center gap-2 border border-primary text-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            {t('tracking.trackButton')}
          </Link>
        </div>
      </section>

      {/* ── Shipping FAQs ─────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-secondary mb-6">{t('faqs.title')}</h2>
        <div className="space-y-4">
          {SHIPPING_FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-secondary text-sm">{q}</p>
              <p className="text-sm text-muted mt-1">{a}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-5 border-t border-border text-center">
          <p className="text-sm text-muted mb-3">{t('faqs.moreQuestions')}</p>
          <Link href={`/${locale}/pages/faq`} className="text-primary text-sm hover:underline">
            {t('faqs.viewFaq')}
          </Link>
        </div>
      </section>
    </div>
  );
}
