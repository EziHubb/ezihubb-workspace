import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildAlternates } from '../../../lib/seo';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CollectionDto, CategoryDto, ProductListItemDto, ReviewDto } from '@ezihubb/types';
import type { PaginatedResponse } from '@ezihubb/types';
import { HeroBanner } from '../../../components/home/HeroBanner';
import { CollectionsGrid } from '../../../components/home/CollectionsGrid';
import { HowItWorks } from '../../../components/home/HowItWorks';
import { TrendingProducts } from '../../../components/home/TrendingProducts';
import { CategoryShowcase } from '../../../components/home/CategoryShowcase';
import { SocialProof } from '../../../components/home/SocialProof';
import { FeaturedReviews } from '../../../components/home/FeaturedReviews';
import { NewsletterSection } from '../../../components/home/NewsletterSection';
import { MobileHeroCarousel } from '../../../components/home/MobileHeroCarousel';
import { warnIfRejected } from '../../../lib/warn-if-rejected';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  const title = 'Personalized Gifts Made with Love';
  const description = 'Create meaningful personalized gifts with photos, names & messages. Made to order, shipped worldwide. Free shipping on $50+.';
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
  const localeHeaders = { 'X-Locale': locale };
  const [trendingRes, collectionsRes, featuredRes, categoriesRes] =
    await Promise.allSettled([
      apiClient.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
        params: { sort: 'bestseller', limit: 8, isActive: true },
        headers: localeHeaders,
      }),
      apiClient.get<PaginatedResponse<CollectionDto>>(API_ROUTES.CATALOG.COLLECTIONS, {
        params: { isActive: true, limit: 6 },
        headers: localeHeaders,
      }),
      // No `featured` param: GET /reviews has no such concept. Review has no
      // isFeatured column and getGlobalReviews() only ever returns APPROVED
      // reviews newest-first, so the param was never read — and because the
      // API runs ValidationPipe with forbidNonWhitelisted, sending it made
      // every request 400. The rejection then landed in the allSettled
      // fallback below and the whole section vanished with no error anywhere.
      // Backlog: featured reviews need a real definition (likely an
      // isFeatured column) rather than being inferred from rating/helpfulCount.
      apiClient.get<PaginatedResponse<ReviewDto>>(API_ROUTES.REVIEWS.LIST, {
        params: { limit: 3 },
      }),
      apiClient.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES, {
        params: { level: 1 },
        headers: localeHeaders,
      }),
    ]);

  // A rejected fetch here degrades to [] and the section below simply stops
  // rendering — indistinguishable from "no data yet" and invisible in prod.
  // That is exactly how GET /reviews?featured=true 400'd for weeks with the
  // homepage reviews section silently missing. This runs in a Server
  // Component, so the warning goes to the container's stdout
  // (`docker compose logs client`) and never reaches the browser.
  warnIfRejected('home:trending',   API_ROUTES.PRODUCTS.LIST,       trendingRes);
  warnIfRejected('home:collections', API_ROUTES.CATALOG.COLLECTIONS, collectionsRes);
  warnIfRejected('home:featuredReviews', API_ROUTES.REVIEWS.LIST,    featuredRes);
  warnIfRejected('home:rootCategories',  API_ROUTES.CATALOG.CATEGORIES, categoriesRes);

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
      {/* Mobile-only rotating feature carousel (hidden on md+) */}
      <MobileHeroCarousel locale={locale} />

      {/* Desktop hero (hidden on mobile to avoid duplication) */}
      <div className="hidden md:block">
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
      </div>

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
