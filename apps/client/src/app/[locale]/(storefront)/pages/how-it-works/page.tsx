import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ShoppingBag, Pencil, Wrench, Truck, Lightbulb,
  ShieldCheck, Lock, Clock, MessageCircle,
} from 'lucide-react';
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
    title: 'How It Works',
    description:
      "Creating a personalized gift is easy. Choose a product, customize it with your photos and names, preview it, and we'll ship it to your door.",
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/how-it-works', locale),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Step {
  step:  string;
  title: string;
  desc:  string;
  tip:   string;
  Icon:  LucideIcon;
  image: string;
}

interface Guarantee {
  Icon:  LucideIcon;
  title: string;
  desc:  string;
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.howItWorks' });

  const steps: Step[] = [
    {
      step:  '01',
      title: t('steps.browse.title'),
      desc:  t('steps.browse.desc'),
      tip:   t('steps.browse.tip'),
      Icon:  ShoppingBag,
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&q=80',
    },
    {
      step:  '02',
      title: t('steps.personalize.title'),
      desc:  t('steps.personalize.desc'),
      tip:   t('steps.personalize.tip'),
      Icon:  Pencil,
      image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&q=80',
    },
    {
      step:  '03',
      title: t('steps.craft.title'),
      desc:  t('steps.craft.desc'),
      tip:   t('steps.craft.tip'),
      Icon:  Wrench,
      image: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=500&q=80',
    },
    {
      step:  '04',
      title: t('steps.delivery.title'),
      desc:  t('steps.delivery.desc'),
      tip:   t('steps.delivery.tip'),
      Icon:  Truck,
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&q=80',
    },
  ];

  const guarantees: Guarantee[] = [
    {
      Icon:  ShieldCheck,
      title: t('guarantees.items.quality.title'),
      desc:  t('guarantees.items.quality.desc'),
    },
    {
      Icon:  Lock,
      title: t('guarantees.items.secure.title'),
      desc:  t('guarantees.items.secure.desc'),
    },
    {
      Icon:  Clock,
      title: t('guarantees.items.onTime.title'),
      desc:  t('guarantees.items.onTime.desc'),
    },
    {
      Icon:  MessageCircle,
      title: t('guarantees.items.support.title'),
      desc:  t('guarantees.items.support.desc'),
    },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 tracking-wide uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4">
          {t('title')}
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* ── Step-by-step ──────────────────────────────────────────────────── */}
      <section className="mb-20">
        {steps.map(({ step, title, desc, tip, Icon, image }, i) => (
          <div
            key={step}
            className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-10 items-center mb-16`}
          >
            {/* Image */}
            <div className="flex-1 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={title} className="w-full h-full object-cover" />
              </div>
              {/* Step badge */}
              <div className="absolute -top-4 -left-4 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">{step}</span>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-secondary">{title}</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">{desc}</p>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-secondary flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong>{t('tipLabel')}</strong> {tip}</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Guarantees ────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10 mb-16">
        <h2 className="text-2xl font-bold text-secondary text-center mb-8">
          {t('guarantees.title')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {guarantees.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-secondary mb-1">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ teaser ────────────────────────────────────────────────────── */}
      <section className="text-center">
        <p className="text-muted mb-4">{t('faqTeaser.prompt')}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href={`/${locale}/pages/faq`}
            className="border border-border rounded-full px-5 py-2.5 text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            {t('faqTeaser.viewFaq')}
          </Link>
          <Link
            href={`/${locale}/pages/contact`}
            className="border border-border rounded-full px-5 py-2.5 text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            {t('faqTeaser.contactSupport')}
          </Link>
        </div>
      </section>
    </div>
  );
}
