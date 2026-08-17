import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  Home, Clock, Heart, TrendingUp, Gift, Users,
  Briefcase, Mail, Lightbulb, Target, Handshake,
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
    title: 'Careers',
    description:
      "Join the EziHubb team. We're a small, passionate team creating personalized gifts. See open roles or send us your resume.",
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/careers', locale),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.careers' });

  const perks: { Icon: LucideIcon; text: string }[] = [
    { Icon: Home,       text: t('perks.remote')     },
    { Icon: Clock,      text: t('perks.flexible')   },
    { Icon: Heart,      text: t('perks.mission')    },
    { Icon: TrendingUp, text: t('perks.growth')     },
    { Icon: Gift,       text: t('perks.discounts')  },
    { Icon: Users,      text: t('perks.ownership')  },
  ];

  const values: { Icon: LucideIcon; title: string; desc: string }[] = [
    {
      Icon:  Lightbulb,
      title: t('values.items.creative.title'),
      desc:  t('values.items.creative.desc'),
    },
    {
      Icon:  Target,
      title: t('values.items.ownership.title'),
      desc:  t('values.items.ownership.desc'),
    },
    {
      Icon:  Handshake,
      title: t('values.items.customer.title'),
      desc:  t('values.items.customer.desc'),
    },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4">
          {t('title')}
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* ── Culture ───────────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-12 items-center mb-20">
        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F1EB]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80"
            alt={t('cultureImageAlt')}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-secondary mb-4">{t('cultureTitle')}</h2>
          <div className="space-y-4">
            {perks.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-secondary">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Roles ────────────────────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('openPositions.title')}</h2>

        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Briefcase className="w-10 h-10 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-secondary mb-2">
            {t('openPositions.emptyTitle')}
          </h3>
          <p className="text-muted text-sm max-w-sm mx-auto mb-6">
            {t('openPositions.emptyDesc')}
          </p>
          <a
            href="mailto:careers@ezihubb.com"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Mail className="w-4 h-4" />
            {t('openPositions.resumeButton')}
          </a>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10">
        <h2 className="text-2xl font-bold text-secondary text-center mb-8">
          {t('values.title')}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {values.map(({ Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-secondary mb-1">{title}</h3>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
