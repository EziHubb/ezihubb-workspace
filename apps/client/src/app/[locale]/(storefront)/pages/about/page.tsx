import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Heart, Leaf, Shield, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'About Us',
    description: 'Learn about our mission to create meaningful, personalized gifts — designed by us and printed on demand for every occasion.',
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.about' });

  const STATS = [
    { value: t('stats.madeToOrder.value'), label: t('stats.madeToOrder.label') },
    { value: t('stats.usaPrinted.value'),  label: t('stats.usaPrinted.label')  },
    { value: t('stats.noInventory.value'), label: t('stats.noInventory.label') },
  ];

  const PROCESS_STEPS = [
    {
      step:        '01',
      title:       t('process.steps.personalize.title'),
      description: t('process.steps.personalize.description'),
      emoji:       '✏️',
    },
    {
      step:        '02',
      title:       t('process.steps.print.title'),
      description: t('process.steps.print.description'),
      emoji:       '🛠️',
    },
    {
      step:        '03',
      title:       t('process.steps.deliver.title'),
      description: t('process.steps.deliver.description'),
      emoji:       '📦',
    },
  ];

  const VALUES = [
    {
      icon:  Heart,
      title: t('values.items.love.title'),
      description: t('values.items.love.description'),
      accent: 'text-error bg-error/8',
    },
    {
      icon:  Shield,
      title: t('values.items.quality.title'),
      description: t('values.items.quality.description'),
      accent: 'text-primary bg-primary/8',
    },
    {
      icon:  Leaf,
      title: t('values.items.sustainable.title'),
      description: t('values.items.sustainable.description'),
      accent: 'text-success bg-success/8',
    },
    {
      icon:  Users,
      title: t('values.items.customer.title'),
      description: t('values.items.customer.description'),
      accent: 'text-warning bg-warning/8',
    },
  ];

  return (
    <div className="bg-background">

      {/* ── Hero: full-bleed image + headline overlay ── */}
      <section className="relative h-[52vh] md:h-[65vh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1615529328331-f8917597711f?w=1600&q=80"
          alt={t('heroImageAlt')}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[1440px] w-full mx-auto px-4 md:px-8 pb-10 md:pb-16">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-3">
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-2xl">
              {t('heroTitleLine1')}<br />{t('heroTitleLine2')}
            </h1>
          </div>
        </div>
      </section>

      {/* ── Mission: 2-col quote / paragraph ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <blockquote className="font-display text-2xl md:text-3xl font-bold text-primary italic leading-relaxed">
              &ldquo;{t('quote')}&rdquo;
            </blockquote>
          </div>
          <div className="space-y-4 text-secondary text-base leading-relaxed">
            <p>{t('missionP1')}</p>
            <p>{t('missionP2')}</p>
            <p>{t('missionP3')}</p>
          </div>
        </div>
      </section>

      {/* ── Stats banner ── */}
      <section className="bg-primary py-12 md:py-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-x-0 md:divide-x divide-white/20">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-4">
                <p className="font-display text-2xl md:text-3xl font-bold text-white mb-1">
                  {value}
                </p>
                <p className="text-white/70 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works / process ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('process.title')}
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            {t('process.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {PROCESS_STEPS.map(({ step, title, description, emoji }) => (
            <div key={step} className="text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 bg-primary/8 rounded-full mb-5 text-3xl">
                <span role="img" aria-hidden="true">{emoji}</span>
                <span className="absolute -top-1 -right-1 w-7 h-7 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {step}
                </span>
              </div>
              <h3 className="font-semibold text-xl text-secondary mb-3">{title}</h3>
              <p className="text-muted text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-surface py-16 md:py-20 border-t border-border">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
              {t('values.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ icon: Icon, title, description, accent }) => (
              <div
                key={title}
                className="border border-border rounded-card p-6 text-center hover:border-primary/40 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${accent}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-secondary mb-2">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20 text-center">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-4">
          {t('cta.title')}
        </h2>
        <p className="text-muted mb-8 max-w-sm mx-auto">
          {t('cta.subtitle')}
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3.5 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('cta.button')}
        </Link>
      </section>
    </div>
  );
}
