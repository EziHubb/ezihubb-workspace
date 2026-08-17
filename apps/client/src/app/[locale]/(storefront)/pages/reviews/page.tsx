import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductListItemDto, PaginatedResponse } from '@ezihubb/types';
import { ReviewsPageStructuredData } from '../../../../../components/seo/ReviewsPageStructuredData';
import { fmtRating, safeArr, safeNum } from '@ezihubb/utils';
import { buildAlternates } from '../../../../../lib/seo';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Customer Reviews',
    description:
      "Read real reviews from people who've ordered personalized gifts from EziHubb.",
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/reviews', locale),
  };
}

// ── Types returned by the new global endpoints ────────────────────────────────

interface ReviewAuthor {
  id:         string;
  firstName?: string | null;
  lastName?:  string | null;
  avatarUrl?: string | null;
}

interface GlobalReview {
  id:         string;
  rating:     number;
  title?:     string | null;
  body:       string;
  imageUrls:  string[];
  createdAt:  string;
  author:     ReviewAuthor;
  product:    { name: string; slug: string; primaryImage: string | null };
}

interface GlobalSummary {
  averageRating: number;
  totalReviews:  number;
  distribution:  Record<1 | 2 | 3 | 4 | 5, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

// Filled star SVG — used for both static 5-star rows and per-review ratings
function StarFilled({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? 'w-4 h-4'}
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <StarFilled
          key={s}
          className={`${cls} ${s <= rating ? 'text-yellow-400' : 'text-[#E5E7EB]'}`}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.reviews' });

  const [summaryRes, reviewsRes, topProductsRes] = await Promise.allSettled([
    apiClient.get<GlobalSummary>(API_ROUTES.REVIEWS.SUMMARY),
    apiClient.get<PaginatedResponse<GlobalReview>>(API_ROUTES.REVIEWS.LIST, {
      params: { limit: 12 },
    }),
    apiClient.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.PRODUCTS.LIST, {
      params: { sort: 'rating', limit: 6, isActive: true },
    }),
  ]);

  const summary     = summaryRes.status     === 'fulfilled' ? summaryRes.value           : null;
  const reviews     = reviewsRes.status     === 'fulfilled' ? safeArr(reviewsRes.value.data)     : [];
  const topProducts = topProductsRes.status === 'fulfilled' ? safeArr(topProductsRes.value.data) : [];

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-16">
      {summary && (
        <ReviewsPageStructuredData
          avgRating={summary.averageRating}
          totalCount={summary.totalReviews}
        />
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4">
          {t('title')}
        </h1>
        <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
          {t('subtitle')}
        </p>

        {/* Overall rating card */}
        {summary && (
          <div className="inline-flex items-center gap-4 bg-white border border-border rounded-2xl px-8 py-5 shadow-sm">
            <div className="text-center">
              <p className="text-5xl font-bold text-secondary">
                {fmtRating(summary.averageRating)}
              </p>
              <div className="flex gap-0.5 justify-center mt-1">
                <StarRow rating={5} size="lg" />
              </div>
            </div>
            <div className="text-left border-l border-border pl-4">
              <p className="font-semibold text-secondary">
                {t('reviewsCount', { count: safeNum(summary.totalReviews).toLocaleString() })}
              </p>
              {summary.totalReviews > 0 && (
                <p className="text-sm text-muted">
                  {t('gaveFiveStars', { percent: Math.round((safeNum(summary.distribution?.[5]) / summary.totalReviews) * 100) })}
                </p>
              )}
              <p className="text-sm text-green-600 mt-0.5">{t('verifiedPurchasesOnly')}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Rating distribution ───────────────────────────────────────────── */}
      {summary && (
        <div className="max-w-sm mx-auto mb-14">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = safeNum(summary.distribution?.[star]);
            const pct   = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3 mb-2">
                <span className="text-sm text-muted w-6 shrink-0">{star}★</span>
                <div className="flex-1 h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Review grid ───────────────────────────────────────────────────── */}
      {reviews.length > 0 ? (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white border border-border rounded-2xl p-6 hover:shadow-md transition-shadow"
            >
              {/* Stars */}
              <div className="mb-3">
                <StarRow rating={review.rating} />
              </div>

              {/* Title + body */}
              {review.title && (
                <p className="font-semibold text-secondary mb-1">{review.title}</p>
              )}
              <p className="text-sm text-muted leading-relaxed line-clamp-4">{review.body}</p>

              {/* Customer photo */}
              {safeArr(review.imageUrls)[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={safeArr(review.imageUrls)[0]}
                  alt={t('customerPhotoAlt')}
                  className="w-full h-32 object-cover rounded-xl mt-4"
                />
              )}

              {/* Author row */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {review.author.firstName?.[0]?.toUpperCase() ?? 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">
                    {review.author.firstName ?? t('anonymous')}
                  </p>
                  <p className="text-xs text-muted">{formatDate(review.createdAt, locale)}</p>
                </div>
                <span className="ml-auto text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                  {t('verifiedBadge')}
                </span>
              </div>

              {/* Product name */}
              <p className="text-xs text-muted mt-2 truncate">
                {t('purchased')}{' '}
                <Link href={`/products/${review.product.slug}`} className="hover:text-primary transition-colors">
                  {review.product.name}
                </Link>
              </p>
            </div>
          ))}
        </section>
      ) : (
        <div className="text-center py-16 text-muted mb-16">
          <p className="text-lg">{t('noReviews')}</p>
        </div>
      )}

      {/* ── Top rated products ────────────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-secondary mb-6 text-center">
            {t('topRated')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {topProducts.map((product) => (
              <Link key={product.id} href={`/products/${product.slug}`} className="group text-center">
                <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-[#F5F1EB]">
                  {product.images?.[0]?.url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <p className="text-xs text-secondary line-clamp-2 leading-snug">{product.name}</p>
                {product.reviewCount > 0 && (
                  <p className="text-xs font-bold text-primary mt-0.5">
                    {fmtRating(product.averageRating ?? 0)} ★
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
