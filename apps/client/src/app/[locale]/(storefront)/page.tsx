import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { CollectionDto, CategoryDto, ProductListItemDto, ReviewDto } from '@mlh/types';
import { HeroBanner } from '../../../components/home/HeroBanner';
import { CollectionsGrid } from '../../../components/home/CollectionsGrid';
import { HowItWorks } from '../../../components/home/HowItWorks';
import { TrendingProducts } from '../../../components/home/TrendingProducts';
import { CategoryShowcase } from '../../../components/home/CategoryShowcase';
import { FeaturedReviews } from '../../../components/home/FeaturedReviews';
import { NewsletterSection } from '../../../components/home/NewsletterSection';

export const revalidate = 60;

// Fetches a paginated-envelope list; returns [] on any error so page never crashes
async function fetchList<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { success: boolean; data: T[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: t('defaultTitle'),
    description: t('defaultDescription'),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  // All 4 fetches in parallel
  const [trendingProducts, collections, featuredReviews, rootCategories] = await Promise.all([
    fetchList<ProductListItemDto>(`${base}/api/v1/products?sort=bestseller&limit=8`),
    fetchList<CollectionDto>(`${base}/api/v1/collections?isActive=true&limit=6`),
    fetchList<ReviewDto>(`${base}/api/v1/reviews?featured=true&limit=3`),
    fetchList<CategoryDto>(`${base}/api/v1/categories?parentId=null`),
  ]);

  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="bg-background">
      {/* a. Hero Banner */}
      <HeroBanner
        locale={locale}
        headline={t('hero.headline')}
        subheadline={t('hero.subheadline')}
        ctaPrimary={t('hero.ctaPrimary')}
        ctaSecondary={t('hero.ctaSecondary')}
        trust1={t('hero.trust1')}
        trust2={t('hero.trust2')}
        trust3={t('hero.trust3')}
      />

      {/* b. Collections Grid — hidden gracefully when API returns empty */}
      {collections.length > 0 && (
        <CollectionsGrid collections={collections} locale={locale} />
      )}

      {/* c. How It Works — 4 steps */}
      <HowItWorks locale={locale} />

      {/* d. Trending Products carousel / grid */}
      <TrendingProducts
        products={trendingProducts}
        locale={locale}
        viewAllLabel={t('trending.viewAll')}
      />

      {/* e. Category Showcase — falls back to static tiles if API empty */}
      <CategoryShowcase categories={rootCategories} locale={locale} />

      {/* f. Social Proof — 3 stats */}
      <section className="bg-primary/5 border-y border-border py-12 md:py-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-4 py-2">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary mb-1">
                {t('socialProof.orders')}
              </p>
              <p className="text-muted text-sm">{t('socialProof.ordersLabel')}</p>
            </div>
            <div className="px-4 py-2">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary mb-1">
                {t('socialProof.rating')}
              </p>
              <p className="text-muted text-sm">{t('socialProof.ratingLabel')}</p>
            </div>
            <div className="px-4 py-2">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary mb-1">
                {t('socialProof.customers')}
              </p>
              <p className="text-muted text-sm">{t('socialProof.customersLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* g. Featured Reviews — hidden when API returns empty */}
      {featuredReviews.length > 0 && (
        <FeaturedReviews reviews={featuredReviews} locale={locale} />
      )}

      {/* h. Newsletter — client component receives translated strings as props */}
      <NewsletterSection
        title={t('newsletter.title')}
        subtitle={t('newsletter.subtitle')}
        placeholder={t('newsletter.placeholder')}
        cta={t('newsletter.cta')}
        disclaimer={t('newsletter.disclaimer')}
        success={t('newsletter.success')}
      />
    </div>
  );
}
