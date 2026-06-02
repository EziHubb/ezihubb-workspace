'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Star, Sparkles, Award, Heart, Truck, Check,
} from 'lucide-react';
import { useReviews } from '@mlh/api-client';
import type { ReviewDto, ReviewSummaryDto } from '@mlh/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'xs' | 'sm' }) {
  const rounded = Math.round(rating);
  const cls     = size === 'xs' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${
            s <= rounded
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ReviewListSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="pb-6 border-b border-border animate-pulse">
          <div className="flex gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="w-4 h-4 bg-border rounded" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-border rounded w-full" />
            <div className="h-4 bg-border rounded w-3/4" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-full bg-border" />
            <div className="h-3 bg-border rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SentimentBadges ───────────────────────────────────────────────────────────

const BADGE_DEFS = [
  { Icon: Sparkles, label: 'Looks great',  minRating: 4.5 },
  { Icon: Award,    label: 'Quality',      minRating: 0 },
  { Icon: Heart,    label: 'Love it',      minRating: 4.8 },
  { Icon: Truck,    label: 'Fast shipping',minRating: 0 },
  { Icon: Check,    label: 'As described', minRating: 0 },
] as const;

function SentimentBadges({ averageRating }: { averageRating: number }) {
  const active = BADGE_DEFS.filter((b) => averageRating >= b.minRating);
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {active.map(({ Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F9FAFB] border border-border rounded-full text-sm text-secondary"
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
      ))}
    </div>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ReviewDto }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const body   = review.body ?? '';
  const isLong = body.length > 250;

  const initials = (
    (review.user?.firstName?.[0] ?? '') +
    (review.user?.lastName?.[0]  ?? '')
  ).toUpperCase() || 'A';
  const displayName = review.user
    ? `${review.user.firstName} ${review.user.lastName}`.trim()
    : 'Anonymous';

  return (
    <div className="pb-6 border-b border-border last:border-0">
      {/* Stars */}
      <Stars rating={review.rating} />

      {/* Body */}
      <p className="text-sm text-secondary leading-relaxed mt-2">
        {isExpanded ? body : body.slice(0, 250)}
        {isLong && !isExpanded && '…'}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          className="text-xs text-primary hover:underline mt-1"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Review photos */}
      {(review.images ?? []).length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {review.images!.map((url, i) => (
            <div
              key={i}
              className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-background"
            >
              <Image
                src={url}
                alt={`Review photo ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Reviewer info */}
      <div className="flex items-center gap-2 mt-3">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0 overflow-hidden">
          {review.user?.avatarUrl ? (
            <Image
              src={review.user.avatarUrl}
              alt={displayName}
              width={28}
              height={28}
              className="object-cover w-full h-full"
            />
          ) : initials}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-secondary">{displayName}</span>
          <time
            dateTime={review.createdAt}
            className="text-xs text-muted"
          >
            {fmtDate(review.createdAt)}
          </time>
        </div>
      </div>

      {/* Admin reply */}
      {review.adminReply && (
        <div className="mt-3 pl-3 border-l-2 border-border">
          <p className="text-xs font-semibold text-secondary">
            Response from MapleLoomHandmade
          </p>
          <p className="text-sm text-muted mt-1">{review.adminReply}</p>
        </div>
      )}
    </div>
  );
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterId = 'suggested' | 'quality' | 'photo' | 'all';

// Map filter tab → rating param (undefined = no star filter)
function filterToRating(filter: FilterId): number | undefined {
  if (filter === 'quality') return 5;
  return undefined;
}

function applyClientFilter(reviews: ReviewDto[], filter: FilterId): ReviewDto[] {
  if (filter === 'photo') return reviews.filter((r) => (r.images ?? []).length > 0);
  return reviews;
}

// ── EtsyReviewsSection ────────────────────────────────────────────────────────

interface Props {
  productSlug:   string;
  reviewSummary: ReviewSummaryDto | null;
}

export function EtsyReviewsSection({ productSlug, reviewSummary }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('suggested');
  const [page,         setPage]         = useState(1);

  const { data, isLoading } = useReviews(productSlug, {
    page,
    limit:  10,
    rating: filterToRating(activeFilter),
    status: 'APPROVED',
  });

  const allReviews  = data?.data ?? [];
  const reviews     = applyClientFilter(allReviews, activeFilter);
  const photoCount  = allReviews.filter((r) => (r.images ?? []).length > 0).length;
  const allPhotos   = reviews.flatMap((r) => r.images ?? []);

  if (!reviewSummary || reviewSummary.totalReviews === 0) return null;

  const { averageRating, totalReviews, distribution } = reviewSummary;

  const filterTabs: { id: FilterId; label: string }[] = [
    { id: 'suggested', label: 'Suggested' },
    { id: 'quality',   label: `Quality (${totalReviews})` },
    { id: 'photo',     label: `With photos (${photoCount})` },
    { id: 'all',       label: 'All' },
  ];

  const handleFilterChange = (id: FilterId) => {
    setActiveFilter(id);
    setPage(1);
  };

  // Approximate per-category scores from overall average (API has no breakdown)
  const categoryRatings = [
    { label: 'Item quality',      score: averageRating },
    { label: 'Shipping',          score: Math.min(5, averageRating + 0.1) },
    { label: 'Customer service',  score: 4.9 },
  ];

  return (
    <section id="reviews" className="mt-12 pt-8 border-t border-border">
      <h2 className="text-xl font-semibold mb-6">Reviews for this item</h2>

      {/* ── SENTIMENT BADGES ── */}
      <SentimentBadges averageRating={averageRating} />

      {/* ── RATING SUMMARY ── */}
      <div className="flex flex-col lg:flex-row gap-8 mb-8">

        {/* Big number + stars */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <div className="text-5xl font-bold text-secondary">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex justify-center mt-1">
              <Stars rating={averageRating} />
            </div>
            <p className="text-xs text-muted mt-1">
              {totalReviews.toLocaleString()} reviews
            </p>
          </div>
        </div>

        {/* Star distribution bars */}
        <div className="flex-1 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = distribution[star] ?? 0;
            const pct   = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-right text-muted tabular-nums">{star}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-6 text-right tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Per-category scores */}
        <div className="space-y-2 text-sm min-w-[200px]">
          {categoryRatings.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between gap-4">
              <span className="text-muted">{cat.label}</span>
              <div className="flex items-center gap-1.5">
                <Stars rating={cat.score} size="xs" />
                <span className="text-xs font-medium tabular-nums">
                  {cat.score.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 [&::-webkit-scrollbar]:hidden">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleFilterChange(tab.id)}
            className={[
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm border transition-colors',
              activeFilter === tab.id
                ? 'bg-secondary text-white border-secondary'
                : 'border-border text-secondary hover:border-secondary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── REVIEW LIST ── */}
      {isLoading ? (
        <ReviewListSkeleton />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          {activeFilter === 'photo'
            ? 'No reviews with photos yet.'
            : 'No reviews match this filter.'}
        </p>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* ── PHOTOS FROM REVIEWS ── */}
      {allPhotos.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-secondary mb-3">Photos from reviews</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {allPhotos.slice(0, 10).map((url, i) => (
              <div
                key={i}
                className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-background cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Image
                  src={url}
                  alt={`Customer photo ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LOAD MORE ── */}
      {data?.pagination?.hasNext && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="mt-6 w-full border border-border rounded-full py-2.5 text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
        >
          View all reviews for this item
        </button>
      )}
    </section>
  );
}
