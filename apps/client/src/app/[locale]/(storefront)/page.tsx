import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildAlternates } from '../../../lib/seo';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import type { CollectionDto, CategoryDto, ProductListItemDto, ReviewDto } from '@mlh/types';
import type { PaginatedResponse } from '@mlh/types';
import { HeroBanner } from '../../../components/home/HeroBanner';
import { CollectionsGrid } from '../../../components/home/CollectionsGrid';
import { HowItWorks } from '../../../components/home/HowItWorks';
import { TrendingProducts } from '../../../components/home/TrendingProducts';
import { CategoryShowcase } from '../../../components/home/CategoryShowcase';
import { SocialProof } from '../../../components/home/SocialProof';
import { FeaturedReviews } from '../../../components/home/FeaturedReviews';
import { NewsletterSection } from '../../../components/home/NewsletterSection';
import { CreatorNetworkCta } from '../../../components/home/CreatorNetworkCta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  const title = 'Personalized Gifts Made with Love | DailyDaisy';
  const description = 'Create meaningful personalized gifts with photos, names & messages. 50,000+ happy customers. Free shipping on $50+.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: locale === 'vi' ? '/vi' : '/',
    },
    alternates: buildAlternates('/', locale),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // All fetches in parallel — Promise.allSettled so a single failure never crashes the page
  const [trendingRes, collectionsRes, featuredRes, categoriesRes] =
    await Promise.allSettled([
      apiClient.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
        params: { sort: 'bestseller', limit: 8, isActive: true },
      }),
      apiClient.get<PaginatedResponse<CollectionDto>>(API_ROUTES.CATALOG.COLLECTIONS, {
        params: { isActive: true, limit: 6 },
      }),
      apiClient.get<PaginatedResponse<ReviewDto>>(API_ROUTES.REVIEWS.LIST, {
        params: { featured: true, limit: 3 },
      }),
      apiClient.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES, {
        params: { level: 1 },
      }),
    ]);

  // apiClient auto-unwraps envelope; .value IS the payload, .value.data for paginated arrays
  const trendingProducts =
    trendingRes.status === 'fulfilled' ? (trendingRes.value.data ?? []) : [];
  const collections =
    collectionsRes.status === 'fulfilled' ? (collectionsRes.value.data ?? []) : [];
  const featuredReviews =
    featuredRes.status === 'fulfilled' ? (featuredRes.value.data ?? []) : [];
  const rootCategories =
    categoriesRes.status === 'fulfilled' ? (categoriesRes.value ?? []) : [];

  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="bg-background">
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

      <CollectionsGrid collections={collections} locale={locale} />

      <HowItWorks locale={locale} />

      <TrendingProducts
        products={trendingProducts}
        locale={locale}
        viewAllLabel={t('trending.viewAll')}
      />

      <CategoryShowcase categories={rootCategories} locale={locale} />

      <SocialProof locale={locale} />

      {featuredReviews.length > 0 && (
        <FeaturedReviews reviews={featuredReviews} locale={locale} />
      )}

      <CreatorNetworkCta locale={locale} />

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
