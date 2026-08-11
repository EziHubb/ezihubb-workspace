import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Gift, Share2, DollarSign } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'creator' });
  return {
    title: t('landing.metaTitle'),
    description: t('landing.metaDescription'),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CreatorNetworkPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'creator' });

  const TIERS = [
    { icon: '🎨', name: t('landing.tierCreatorName'), sub: t('landing.tierCreatorSub'), rate: '10%',   bonus: null,                              bg: 'bg-[#F1EFE8]', border: 'border-[#E8E4DF]', text: 'text-secondary', bColor: ''               },
    { icon: '🌱', name: t('landing.tierRisingName'),  sub: t('landing.tierRisingSub'),  rate: '10.5%', bonus: '+0.5%',                           bg: 'bg-[#EAF3DE]', border: 'border-[#C8E6C9]', text: 'text-[#2E7D52]', bColor: 'text-[#2E7D52]' },
    { icon: '⭐', name: t('landing.tierTopName'),     sub: t('landing.tierTopSub'),     rate: '11%',   bonus: '+1%',                             bg: 'bg-[#FAEEDA]', border: 'border-[#FDE68A]', text: 'text-[#D97706]', bColor: 'text-[#D97706]', popular: true },
    { icon: '💎', name: t('landing.tierEliteName'),   sub: t('landing.tierEliteSub'),   rate: '12%',   bonus: '+2%',                             bg: 'bg-[#EEEDFE]', border: 'border-[#C4B5FD]', text: 'text-[#7C3AED]', bColor: 'text-[#7C3AED]' },
  ] as const;

  const STEPS = [
    { icon: Gift,       bg: 'bg-primary',   title: t('landing.step1Title'), body: t('landing.step1Body') },
    { icon: Share2,     bg: 'bg-[#7C3AED]', title: t('landing.step2Title'), body: t('landing.step2Body') },
    { icon: DollarSign, bg: 'bg-[#2E7D52]', title: t('landing.step3Title'), body: t('landing.step3Body') },
  ] as const;

  const TESTIMONIALS = [
    { quote: t('landing.testimonial1Quote'), name: t('landing.testimonial1Name'), handle: t('landing.testimonial1Handle') },
    { quote: t('landing.testimonial2Quote'), name: t('landing.testimonial2Name'), handle: t('landing.testimonial2Handle') },
    { quote: t('landing.testimonial3Quote'), name: t('landing.testimonial3Name'), handle: t('landing.testimonial3Handle') },
  ];

  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg,#FFF0EC 0%,#F3F0FF 100%)' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">

          {/* Text */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#7C3AED] mb-4">
              {t('landing.badge')}
            </p>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-secondary leading-tight">
              {t('landing.heroTitle')}
            </h1>
            <p className="text-muted text-base mt-5 max-w-md">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href={`/${locale}/auth/register`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-button hover:bg-primary/90 transition-colors">
                {t('landing.ctaGetLink')} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works"
                className="inline-flex items-center gap-1.5 px-6 py-3 border border-secondary/20 text-secondary font-medium rounded-button hover:border-secondary/40 transition-colors">
                {t('landing.ctaHowItWorks')}
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400">★★★★★</span>
                <span className="text-muted">{t('landing.socialProofQuote')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#7C3AED]">{t('landing.socialProofCount')}</span>
                <span className="text-muted">{t('landing.socialProofLabel')}</span>
              </span>
            </div>
          </div>

          {/* Floating cards */}
          <div className="relative hidden lg:flex items-center justify-center h-72">
            <div className="absolute top-0 left-4 bg-white rounded-2xl shadow-xl p-5 w-52 -rotate-3 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-lg flex items-center justify-center">🫙</div>
                <div>
                  <p className="text-xs font-semibold text-secondary">{t('landing.floatingProductName')}</p>
                  <p className="text-xs font-bold text-[#2E7D52]">{t('landing.floatingProductEarned')}</p>
                </div>
              </div>
            </div>
            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-xl p-5 w-60 rotate-1 z-20">
              <p className="text-xs text-muted mb-2 font-medium">{t('landing.floatingLinkLabel')}</p>
              <div className="flex items-center gap-2 bg-[#FAFAF8] rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-secondary truncate flex-1">ezihubb.com?c=SARAH2024</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{t('landing.floatingLinkCopy')}</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-4 bg-white rounded-2xl shadow-xl p-5 w-48 rotate-2 z-30">
              <span className="text-[10px] font-bold bg-[#7C3AED] text-white px-2 py-0.5 rounded-full">{t('landing.floatingBadge')}</span>
              <p className="text-2xl font-bold text-[#7C3AED] mt-2">{t('landing.floatingAmount')}</p>
              <p className="text-xs text-muted">{t('landing.floatingAmountLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold text-secondary">{t('landing.howItWorksTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-10 mt-12">
            {STEPS.map(({ icon: Icon, title, body, bg }) => (
              <div key={title} className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h4 className="font-semibold text-secondary">{title}</h4>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIERS ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-secondary">{t('landing.tiersTitle')}</h2>
            <p className="text-muted mt-3">{t('landing.tiersSubtitle')}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier) => (
              <div key={tier.name}
                className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${tier.bg} ${tier.border}`}>
                {'popular' in tier && tier.popular && (
                  <span className="absolute -top-2.5 right-4 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                    {t('landing.tierMostPopular')}
                  </span>
                )}
                <span className="text-3xl">{tier.icon}</span>
                <div>
                  <h4 className={`font-bold text-sm ${tier.text}`}>{tier.name}</h4>
                  <p className="text-xs text-muted mt-0.5">{tier.sub}</p>
                </div>
                <div className="border-t border-black/5 pt-3 space-y-1">
                  <p className="text-sm font-bold text-secondary">{t('landing.tierEarnings', { rate: tier.rate })}</p>
                  {tier.bonus && <p className={`text-xs font-semibold ${tier.bColor}`}>{t('landing.tierBonus', { bonus: tier.bonus })}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUYER DISCOUNT ───────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-secondary">
              {t('landing.discountTitle')}
            </h2>
            <p className="text-muted mt-4">
              {t('landing.discountBody')}
            </p>
            <Link href={`/${locale}/creators#tiers`}
              className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-5 hover:underline">
              {t('landing.discountLearnMore')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-white border border-border rounded-2xl shadow-xl p-6 space-y-3">
            <p className="font-semibold text-secondary text-sm">{t('landing.orderCardTitle')}</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t('landing.orderCardProduct')}</span>
              <span className="font-medium text-secondary">{t('landing.orderCardProductPrice')}</span>
            </div>
            <div className="flex justify-between text-sm text-[#2E7D52]">
              <span className="font-medium">{t('landing.orderCardDiscountLabel')}</span>
              <span className="font-bold">{t('landing.orderCardDiscountValue')}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="font-bold text-secondary">{t('landing.orderCardTotalLabel')}</span>
              <span className="font-bold text-secondary">{t('landing.orderCardTotalValue')}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#FFF0EC] rounded-xl p-3">
              <span>🎁</span>
              <p className="text-xs text-primary font-medium">{t('landing.orderCardSavingsNote')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="bg-[#F3F0FF] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-secondary text-center mb-12">
            {t('landing.testimonialsTitle')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, handle }) => (
              <div key={handle} className="bg-white rounded-2xl p-6 space-y-3">
                <span className="text-amber-400 text-sm">★★★★★</span>
                <p className="text-sm text-secondary italic">"{quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-secondary">{name}</p>
                  <p className="text-xs text-muted">{handle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="bg-primary py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-white">{t('landing.finalCtaTitle')}</h2>
          <p className="text-white/90 mt-3 text-base">{t('landing.finalCtaBody')}</p>
          <Link href={`/${locale}/auth/register`}
            className="inline-flex items-center gap-2 mt-8 px-7 py-3.5 bg-white text-primary font-bold rounded-button hover:bg-white/90 transition-colors">
            {t('landing.finalCtaButton')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
