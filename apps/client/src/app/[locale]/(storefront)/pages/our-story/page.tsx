import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Heart, Sparkles, Users, ArrowRight } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Our Story',
    description:
      'Learn how EziHubb was founded and our mission to create meaningful personalized gifts that bring people closer together.',
    robots: { index: true, follow: true },
  };
}

export default async function OurStoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.ourStory' });

  const values = [
    {
      Icon:  Heart,
      title: t('beliefs.items.story.title'),
      desc:  t('beliefs.items.story.desc'),
    },
    {
      Icon:  Sparkles,
      title: t('beliefs.items.quality.title'),
      desc:  t('beliefs.items.quality.desc'),
    },
    {
      Icon:  Users,
      title: t('beliefs.items.people.title'),
      desc:  t('beliefs.items.people.desc'),
    },
  ];

  const highlights = [
    { title: t('howWeWork.items.designed.title'), desc: t('howWeWork.items.designed.desc') },
    { title: t('howWeWork.items.printed.title'),  desc: t('howWeWork.items.printed.desc')  },
    { title: t('howWeWork.items.shipped.title'),  desc: t('howWeWork.items.shipped.desc')  },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 tracking-wide uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary leading-tight mb-6">
          {t('heroTitleLine1')}<br />{t('heroTitleLine2')}
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          {t('subtitle')}
        </p>
      </div>

      {/* ── Founding story ────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <h2 className="text-2xl font-bold text-secondary mb-4">{t('aboutTitle')}</h2>
          <p className="text-muted leading-relaxed mb-4">
            {t('aboutP1')}
          </p>
          <p className="text-muted leading-relaxed">
            {t('aboutP2')}
          </p>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F1EB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600&q=80"
              alt={t('aboutImageAlt')}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Mission + Values ──────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10 mb-20">
        <h2 className="text-2xl font-bold text-secondary text-center mb-10">
          {t('beliefs.title')}
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {values.map(({ Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-secondary mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How We Work ───────────────────────────────────────────────────── */}
      <section className="text-center mb-20">
        <h2 className="text-2xl font-bold text-secondary mb-10">{t('howWeWork.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {highlights.map(({ title, desc }) => (
            <div key={title}>
              <p className="text-xl font-bold text-primary">{title}</p>
              <p className="text-sm text-muted mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="text-center bg-primary/5 rounded-3xl p-12">
        <h2 className="text-2xl font-bold text-secondary mb-3">
          {t('cta.title')}
        </h2>
        <p className="text-muted mb-6">
          {t('cta.subtitle')}
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-dark transition-colors"
        >
          {t('cta.button')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
