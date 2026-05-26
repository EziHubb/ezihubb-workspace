import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Star, Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { ProductCard } from '../../../components/product/ProductCard';
import { NewsletterForm } from '../../../components/home/NewsletterForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('heroTitle'),
    description: t('heroSubtitle'),
  };
}

// Mock data — in production these come from the products API
const FEATURED_PRODUCTS = [
  {
    slug: 'custom-name-photo-mug',
    image: 'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=400&q=80',
    name: 'Custom Name & Photo Coffee Mug',
    price: 27.99,
    originalPrice: 35.99,
    rating: 5,
    reviewCount: 1243,
    badge: 'bestseller' as const,
  },
  {
    slug: 'personalized-canvas-print',
    image: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=400&q=80',
    name: 'Personalized Family Canvas Print',
    price: 49.99,
    rating: 4.8,
    reviewCount: 876,
    badge: 'new' as const,
  },
  {
    slug: 'monogram-tumbler',
    image: 'https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=400&q=80',
    name: 'Monogram Insulated Tumbler',
    price: 29.99,
    rating: 4.9,
    reviewCount: 654,
    lowStock: true,
  },
  {
    slug: 'custom-photo-pillow',
    image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&q=80',
    name: 'Custom Photo Throw Pillow',
    price: 34.99,
    originalPrice: 44.99,
    rating: 4.7,
    reviewCount: 421,
    badge: 'sale' as const,
  },
];

const CATEGORIES = [
  { key: 'birthday', emoji: '🎂', color: 'bg-pink-50', accent: 'text-pink-600' },
  { key: 'wedding', emoji: '💍', color: 'bg-purple-50', accent: 'text-purple-600' },
  { key: 'anniversary', emoji: '❤️', color: 'bg-red-50', accent: 'text-red-600' },
  { key: 'baby', emoji: '🍼', color: 'bg-blue-50', accent: 'text-blue-600' },
  { key: 'housewarming', emoji: '🏠', color: 'bg-amber-50', accent: 'text-amber-600' },
  { key: 'graduation', emoji: '🎓', color: 'bg-green-50', accent: 'text-green-600' },
] as const;

const TESTIMONIAL_KEYS = [
  { textKey: 'testimonialsT1Text', authorKey: 'testimonialsT1Author', productKey: 'testimonialsT1Product', rating: 5 },
  { textKey: 'testimonialsT2Text', authorKey: 'testimonialsT2Author', productKey: 'testimonialsT2Product', rating: 5 },
  { textKey: 'testimonialsT3Text', authorKey: 'testimonialsT3Author', productKey: 'testimonialsT3Product', rating: 5 },
] as const;

const HOW_IT_WORKS = [
  { step: 1, icon: '🛍️', titleKey: 'step1Title', descKey: 'step1Desc' },
  { step: 2, icon: '✏️', titleKey: 'step2Title', descKey: 'step2Desc' },
  { step: 3, icon: '📦', titleKey: 'step3Title', descKey: 'step3Desc' },
] as const;

const STATS_KEYS = [
  { valueKey: 'statsCustomersValue', labelKey: 'statsCustomersLabel' },
  { valueKey: 'statsRatingValue', labelKey: 'statsRatingLabel' },
  { valueKey: 'statsProductsValue', labelKey: 'statsProductsLabel' },
  { valueKey: 'statsProcessingValue', labelKey: 'statsProcessingLabel' },
] as const;

const TRUST_KEYS = [
  { icon: ShieldCheck, key: 'trustSecureCheckout' },
  { icon: RotateCcw, key: 'trustReturns' },
  { icon: Truck, key: 'trustFreeShipping' },
  { icon: Star, key: 'trustQuality' },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const tProducts = await getTranslations({ locale, namespace: 'home.products' });

  return (
    <div className="bg-background">
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-primary to-primary-dark overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              {t('heroTitle')}
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 leading-relaxed">
              {t('heroSubtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link
                href={`/${locale}/products`}
                className="inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold px-8 py-4 rounded-button hover:bg-gray-50 transition-colors text-sm uppercase tracking-wide"
              >
                {t('heroCta')}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${locale}/collections`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white text-white font-semibold px-8 py-4 rounded-button hover:bg-white/10 transition-colors text-sm uppercase tracking-wide"
              >
                {t('heroSecondary')}
              </Link>
            </div>

            <div className="flex flex-wrap gap-6">
              {[
                { icon: Star, text: t('heroTrustReviews') },
                { icon: ShieldCheck, text: t('heroTrustHandmade') },
                { icon: Truck, text: t('heroTrustShipping') },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-white/90">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Shop by Occasion ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('categoriesTitle')}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            {t('categoriesSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map(({ key, emoji, color, accent }) => (
            <Link
              key={key}
              href={`/${locale}/products?occasion=${key}`}
              className={`${color} rounded-card p-5 text-center hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 group`}
            >
              <div className="text-3xl mb-3">{emoji}</div>
              <p className={`font-semibold text-sm ${accent} group-hover:underline`}>
                {t(`categories.${key}`)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Bestsellers ── */}
      <section className="bg-surface py-16 md:py-20">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between mb-10 md:mb-12">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-2">
                {t('featuredTitle')}
              </h2>
              <p className="text-muted-foreground">{t('featuredSubtitle')}</p>
            </div>
            <Link
              href={`/${locale}/products`}
              className="hidden md:inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
            >
              {t('viewAll')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {FEATURED_PRODUCTS.map((product) => (
              <ProductCard
                key={product.slug}
                locale={locale}
                labelPersonalize={tProducts('personalizeNow')}
                labelLowStock={tProducts('lowStock')}
                {...product}
              />
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link
              href={`/${locale}/products`}
              className="inline-flex items-center gap-2 text-primary font-semibold border border-primary px-6 py-3 rounded-button hover:bg-primary hover:text-white transition-colors text-sm"
            >
              {t('viewAll')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('howItWorksTitle')}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            {t('howItWorksSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {HOW_IT_WORKS.map(({ step, icon, titleKey, descKey }) => (
            <div key={step} className="text-center relative">
              {step < 3 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-border" />
              )}
              <div className="relative inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
                <span className="text-3xl">{icon}</span>
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {step}
                </span>
              </div>
              <h3 className="font-semibold text-xl text-secondary mb-3">{t(titleKey)}</h3>
              <p className="text-muted-foreground leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social Proof Banner ── */}
      <section className="bg-primary/5 border-y border-border py-10">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS_KEYS.map(({ valueKey, labelKey }) => (
              <div key={labelKey}>
                <p className="font-display text-3xl font-bold text-primary mb-1">
                  {t(valueKey)}
                </p>
                <p className="text-muted-foreground text-sm">{t(labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('testimonialsTitle')}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            {t('testimonialsSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIAL_KEYS.map(({ textKey, authorKey, productKey, rating }) => {
            const author = t(authorKey);
            const initials = author.split(' ').map((n) => n[0]).join('');
            return (
              <div key={textKey} className="bg-surface rounded-card p-6 shadow-floating">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-lg ${i < rating ? 'text-warning' : 'text-border'}`}>
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-secondary mb-4 leading-relaxed italic">
                  &ldquo;{t(textKey)}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-secondary">{author}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('testimonialsPurchased', { product: t(productKey) })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Newsletter ── */}
      <section className="bg-secondary py-16 md:py-20">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            {t('newsletterTitle')}
          </h2>
          <p className="text-gray-300 text-base md:text-lg mb-8 max-w-xl mx-auto">
            {t('newsletterSubtitle')}
          </p>
          <NewsletterForm
            placeholder={t('newsletterPlaceholder')}
            ctaLabel={t('newsletterCta')}
            disclaimer={t('newsletterDisclaimer')}
            successMessage={t('newsletterSuccess')}
          />
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="bg-surface border-t border-border py-8">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {TRUST_KEYS.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-2 text-muted-foreground">
                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
