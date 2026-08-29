import { getTranslations } from 'next-intl/server';
import type { ReviewDto } from '@ezihubb/types';

interface FeaturedReviewsProps {
  reviews: ReviewDto[];
  locale: string;
}

export async function FeaturedReviews({
  reviews,
  locale,
}: FeaturedReviewsProps) {
  if (reviews.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('reviews.title')}
          </h2>
          <p className="text-muted text-base md:text-lg">
            {t('reviews.subtitle')}
          </p>
        </div>

        {/* 3-col desktop, vertical stack mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((review) => {
            const firstName = review.author?.firstName ?? '';
            const lastName = review.author?.lastName ?? '';
            const initials =
              `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
            const fullName = `${firstName} ${lastName}`.trim() || 'Anonymous';

            return (
              <article
                key={review.id}
                className="bg-surface rounded-card p-6 shadow-sm border border-border flex flex-col"
              >
                {/* Stars — rendered manually to stay server-side */}
                <div
                  className="flex gap-0.5 mb-4"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < review.rating ? 'text-warning' : 'text-border'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {review.title && (
                  <p className="font-semibold text-secondary mb-2">
                    {review.title}
                  </p>
                )}

                <blockquote className="text-secondary text-sm leading-relaxed italic mb-5 line-clamp-5 flex-1">
                  &ldquo;{review.body}&rdquo;
                </blockquote>

                <footer className="flex items-center gap-3 pt-4 border-t border-border">
                  <div
                    className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-secondary truncate">
                      {fullName}
                    </p>
                    <time
                      dateTime={review.createdAt}
                      className="text-xs text-muted"
                    >
                      {new Date(review.createdAt).toLocaleDateString(
                        locale === 'vi' ? 'vi-VN' : 'en-US',
                        { year: 'numeric', month: 'long', day: 'numeric' },
                      )}
                    </time>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
