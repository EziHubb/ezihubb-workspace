'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useReviews } from '@ezihubb/api-client';
import type { ReviewDto, ReviewSummaryDto } from '@ezihubb/types';

interface ReviewSectionProps {
  productSlug:     string;
  reviewSummary:   ReviewSummaryDto | null;
  initialReviews?: ReviewDto[];
}

function StarBar({
  label, count, total, active, onClick,
}: {
  label:   string;
  count:   number;
  total:   number;
  active:  boolean;
  onClick: () => void;
}) {
  const pct     = total > 0 ? Math.round((count / total) * 100) : 0;
  const isEmpty = count === 0;
  return (
    <button
      type="button"
      onClick={isEmpty ? undefined : onClick}
      disabled={isEmpty}
      className={[
        'w-full flex items-center gap-2 text-sm rounded px-1.5 py-0.5 -mx-1.5 transition-colors text-left',
        active  ? 'bg-yellow-50 ring-1 ring-yellow-300' : '',
        isEmpty ? 'opacity-40 cursor-default' : 'hover:bg-gray-50 cursor-pointer',
      ].join(' ')}
    >
      <span className="text-xs text-secondary w-5 shrink-0">{label}★</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${active ? 'bg-yellow-500' : 'bg-warning'}`}
          style={{ width: `${pct}%` } as React.CSSProperties}
        />
      </div>
      <span className="text-xs text-muted w-6 text-right shrink-0 tabular-nums">{count}</span>
    </button>
  );
}

function ReviewCard({ review }: { review: ReviewDto }) {
  const firstName = review.user?.firstName ?? '';
  const lastName  = review.user?.lastName  ?? '';
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
  const fullName  = `${firstName} ${lastName}`.trim() || 'Anonymous';

  return (
    <article className="py-5 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0 overflow-hidden">
          {review.user?.avatarUrl ? (
            <Image
              src={review.user.avatarUrl}
              alt={fullName}
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          ) : initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-secondary">{fullName}</p>
            <span className="text-[10px] font-semibold text-success bg-success/8 border border-success/20 px-1.5 py-0.5 rounded-pill">
              ✓ Verified
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-3.5 h-3.5 ${i < review.rating ? 'text-warning' : 'text-border'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <time className="text-xs text-muted" dateTime={review.createdAt}>
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </time>
          </div>

          {review.title && (
            <p className="text-sm font-semibold text-secondary mt-2">{review.title}</p>
          )}
          <p className="text-sm text-secondary leading-relaxed mt-1">{review.body}</p>

          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {review.images.map((url, i) => (
                <div key={i} className="relative w-14 h-14 rounded-sm overflow-hidden bg-background">
                  <Image src={url} alt={`Review photo ${i + 1}`} fill sizes="56px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ReviewSection({ productSlug, reviewSummary, initialReviews }: ReviewSectionProps) {
  const [page,       setPage]       = useState(1);
  const [starFilter, setStarFilter] = useState<number | undefined>(undefined);

  // On page 1 with no star filter, use server-rendered data to avoid a loading flash.
  // React Query takes over (refetches in background) once the component mounts.
  const isUsingInitial = page === 1 && !starFilter && !!initialReviews;

  const { data, isLoading, isError } = useReviews(
    productSlug,
    { page, limit: 5, rating: starFilter, status: 'APPROVED' },
    { enabled: Boolean(productSlug) && !isUsingInitial },
  );

  const reviews    = isUsingInitial ? initialReviews! : (data?.data ?? []);
  const totalPages = data?.pagination?.totalPages
    ?? (isUsingInitial ? Math.ceil((reviewSummary?.totalReviews ?? 0) / 5) : 1);

  return (
    <div className="space-y-6">
      {reviewSummary && reviewSummary.totalReviews > 0 ? (
        <>
          {/* Summary card */}
          <div className="flex flex-col sm:flex-row gap-6 p-5 bg-surface border border-border rounded-card">
            <div className="flex flex-col items-center justify-center shrink-0">
              <p className="text-5xl font-bold text-secondary">
                {reviewSummary.averageRating.toFixed(1)}
              </p>
              <div className="flex gap-0.5 my-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(reviewSummary.averageRating) ? 'text-warning' : 'text-border'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs text-muted">{reviewSummary.totalReviews} reviews</p>
            </div>

            <div className="flex-1 space-y-1">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <StarBar
                  key={star}
                  label={String(star)}
                  count={reviewSummary.distribution[star] ?? 0}
                  total={reviewSummary.totalReviews}
                  active={starFilter === star}
                  onClick={() => { setStarFilter((p) => p === star ? undefined : star); setPage(1); }}
                />
              ))}
            </div>
          </div>

          {/* Active filter chip */}
          {starFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-secondary">
                {starFilter}-star reviews
              </span>
              <button
                type="button"
                onClick={() => { setStarFilter(undefined); setPage(1); }}
                className="text-xs text-primary hover:underline"
              >
                All reviews
              </button>
            </div>
          )}

          {/* Review list */}
          {isError ? (
            <p className="text-sm text-error text-center py-6">
              Failed to load reviews.
            </p>
          ) : isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 py-4 border-b border-border animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-border shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border rounded w-28" />
                    <div className="h-3 bg-border rounded w-full" />
                    <div className="h-3 bg-border rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No reviews with this filter.
            </p>
          ) : (
            <>
              <div>{reviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  {page > 1 && (
                    <button
                      type="button"
                      onClick={() => setPage((p) => p - 1)}
                      className="text-sm px-4 py-2 border border-border rounded-button text-secondary hover:border-primary hover:text-primary transition-colors"
                    >
                      ← Previous
                    </button>
                  )}
                  {page < totalPages && (
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      className="text-sm px-4 py-2 border border-border rounded-button text-secondary hover:border-primary hover:text-primary transition-colors"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted">
          <p className="text-base font-medium text-secondary mb-1">No reviews yet</p>
          <p className="text-sm">Be the first to review this product.</p>
        </div>
      )}
    </div>
  );
}
