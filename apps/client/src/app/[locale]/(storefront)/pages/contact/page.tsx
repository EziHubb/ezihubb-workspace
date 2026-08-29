import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MessageCircle, Mail, Package, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ContactForm } from '../../../../../components/pages/ContactForm';
import { buildAlternates } from '../../../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Contact Us',
    description:
      'Get in touch with EziHubb. We respond to all messages within 2 hours during business hours.',
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/contact', locale),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'pages.contact' });
  const rawProduct = Array.isArray(query['product']) ? query['product'][0] : query['product'];
  const productId = rawProduct && /^[A-Za-z0-9_-]{1,100}$/.test(rawProduct)
    ? rawProduct
    : null;

  const CONTACT_CARDS: {
    Icon:    LucideIcon;
    title:   string;
    desc:    string;
    action:  string;
    href:    string;
    accent:  string;
  }[] = [
    {
      Icon:   MessageCircle,
      title:  t('cards.chat.title'),
      desc:   t('cards.chat.desc'),
      action: t('cards.chat.action'),
      href:   '#chat',
      accent: 'bg-blue-50 text-blue-600',
    },
    {
      Icon:   Mail,
      title:  t('cards.email.title'),
      desc:   t('cards.email.desc'),
      action: t('cards.email.action'),
      href:   'mailto:support@ezihubb.com',
      accent: 'bg-green-50 text-green-600',
    },
    {
      Icon:   Package,
      title:  t('cards.orderIssues.title'),
      desc:   t('cards.orderIssues.desc'),
      action: t('cards.orderIssues.action'),
      href:   '/orders/track',
      accent: 'bg-amber-50 text-amber-600',
    },
  ];

  const HOURS = [
    { day: t('hours.mondayFriday'), hours: t('hours.mondayFridayTime') },
    { day: t('hours.saturday'),     hours: t('hours.saturdayTime')     },
    { day: t('hours.sunday'),       hours: t('hours.sundayTime')       },
  ];

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          {t('title')}
        </h1>
        <p className="text-muted text-lg">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_340px] gap-12">

        {/* ── Contact form ──────────────────────────────────────────────── */}
        <ContactForm
          initialSubject={productId ? 'other' : undefined}
          initialMessage={productId ? `[Product ID: ${productId}]\n\n` : undefined}
        />

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {CONTACT_CARDS.map(({ Icon, title, desc, action, href, accent }) => {
            const inner = (
              <>
                <div className={`w-12 h-12 ${accent} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-secondary">{title}</p>
                  <p className="text-sm text-muted mt-0.5">{desc}</p>
                  <p className="text-sm text-primary mt-1 group-hover:underline">{action}</p>
                </div>
              </>
            );
            const cls = 'flex gap-4 p-5 border border-border rounded-2xl hover:border-primary hover:shadow-sm transition-all group block';
            return href.startsWith('/') ? (
              <Link key={title} href={href} className={cls}>{inner}</Link>
            ) : (
              <a key={title} href={href} className={cls}>{inner}</a>
            );
          })}

          {/* Business hours */}
          <div className="border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-secondary mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {t('hours.title')}
            </h3>
            <div className="space-y-1.5 text-sm">
              {HOURS.map(({ day, hours }) => (
                <div key={day} className="flex justify-between">
                  <span className="text-muted">{day}</span>
                  <span className="text-secondary font-medium">{hours}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">
              {t.rich('hours.responseTime', { b: (chunks) => <strong>{chunks}</strong> })}
            </p>
          </div>

          {/* FAQ link */}
          <div className="bg-primary/5 rounded-2xl p-4 text-sm text-secondary">
            <p className="font-semibold mb-1">{t('faqTeaser.title')}</p>
            <p className="text-muted mb-2 text-xs">{t('faqTeaser.desc')}</p>
            <Link href={`/${locale}/pages/faq`} className="text-primary font-medium hover:underline text-xs">
              {t('faqTeaser.link')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
