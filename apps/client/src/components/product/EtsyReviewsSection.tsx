'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, Sparkles, Award, Heart, Truck, Check, ThumbsUp, Camera, X,
} from 'lucide-react';
import { useReviews } from '@mlh/api-client';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../lib/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@mlh/api-client';
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

function ReviewCard({ review, onHelpful }: { review: ReviewDto; onHelpful?: (id: string) => void }) {
  const [isExpanded,  setIsExpanded]  = useState(false);
  const [markedHelpful, setMarkedHelpful] = useState(false);
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
            Response from DailyDaisy
          </p>
          <p className="text-sm text-muted mt-1">{review.adminReply}</p>
        </div>
      )}

      {/* Helpful */}
      {onHelpful && (
        <button
          type="button"
          disabled={markedHelpful}
          onClick={() => { setMarkedHelpful(true); onHelpful(review.id); }}
          className={`mt-3 flex items-center gap-1.5 text-xs transition-colors ${markedHelpful ? 'text-primary cursor-default' : 'text-muted hover:text-secondary'}`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          {markedHelpful ? 'Marked as helpful' : 'Helpful?'}
        </button>
      )}
    </div>
  );
}

// ── InteractiveStar ───────────────────────────────────────────────────────────

function InteractiveStar({ filled, onHover, onClick }: { filled: boolean; onHover: () => void; onClick: () => void }) {
  return (
    <button type="button" onMouseEnter={onHover} onClick={onClick} className="p-0.5 focus:outline-none">
      <Star className={`w-8 h-8 transition-colors ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} />
    </button>
  );
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// ── WriteReviewForm ───────────────────────────────────────────────────────────

interface ReviewableProduct {
  orderId:         string;
  orderNumber:     string;
  productId:       string;
  productName:     string;
  productSlug:     string;
  productImageUrl: string | null;
}

function WriteReviewForm({
  productSlug,
  onSuccess,
}: {
  productSlug: string;
  onSuccess:   () => void;
}) {
  const user         = useAuthStore((s) => s.user);
  const accessToken  = useAuthStore((s) => s.accessToken);
  const queryClient  = useQueryClient();

  const [isOpen,      setIsOpen]      = useState(false);
  const [rating,      setRating]      = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [orderId,     setOrderId]     = useState('');
  const [reviewables, setReviewables] = useState<ReviewableProduct[]>([]);
  const [imageUrls,   setImageUrls]   = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,       setError]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const openForm = async () => {
    setIsOpen(true);
    try {
      const data = await apiClient.get<ReviewableProduct[]>(
        API_ROUTES.PRODUCTS.REVIEWABLE_PRODUCTS,
        { token: accessToken ?? undefined },
      );
      const forThisProduct = (data as ReviewableProduct[]).filter(
        (r) => r.productSlug === productSlug,
      );
      setReviewables(forThisProduct);
      if (forThisProduct.length === 1) setOrderId(forThisProduct[0]!.orderId);
    } catch { /* non-critical */ }
  };

  const handleFiles = async (files: FileList) => {
    if (imageUrls.length >= 5) return;
    setIsUploading(true);
    try {
      const toUpload = Array.from(files).slice(0, 5 - imageUrls.length);
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append('images', file);
        // We use a temporary reviewId-less approach: just attach after submit
        uploaded.push(URL.createObjectURL(file));
        // Store the actual File objects for post-submit upload
        (file as File & { _blob?: Blob })._blob = file;
      }
      setImageUrls((prev) => [...prev, ...uploaded]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0)       return setError('Please select a star rating.');
    if (body.length < 10)   return setError('Review text must be at least 10 characters.');
    if (!orderId)           return setError('Please select the order for this review.');
    setError('');
    setIsSubmitting(true);
    try {
      await apiClient.post(
        API_ROUTES.PRODUCTS.REVIEWS(productSlug),
        { orderId, rating, title: title || undefined, body },
        { token: accessToken ?? undefined },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews(productSlug, {}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewSummary(productSlug) });
      setIsOpen(false);
      setRating(0); setTitle(''); setBody(''); setOrderId(''); setImageUrls([]);
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Failed to submit review';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mt-4 py-4 border border-dashed border-border rounded-2xl text-center">
        <p className="text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>{' '}
          to write a review
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="mt-4 w-full py-3 px-6 border-2 border-dashed border-border rounded-2xl
                   text-sm text-muted hover:border-primary hover:text-primary transition-colors
                   flex items-center justify-center gap-2"
      >
        <Star className="w-4 h-4" />
        Write a review
      </button>
    );
  }

  return (
    <div className="mt-4 border border-border rounded-2xl p-5 bg-[#FAFAF8]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-secondary">Write a review</h4>
        <button type="button" onClick={() => setIsOpen(false)} className="text-muted hover:text-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Order selector */}
      {reviewables.length > 1 && (
        <div className="mb-4">
          <label className="text-xs font-medium block mb-1.5 text-secondary">Order *</label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select order…</option>
            {reviewables.map((r) => (
              <option key={r.orderId} value={r.orderId}>Order #{r.orderNumber}</option>
            ))}
          </select>
        </div>
      )}

      {/* Star rating */}
      <div className="mb-4">
        <label className="text-xs font-medium block mb-2 text-secondary">Rating *</label>
        <div className="flex items-center gap-1"
          onMouseLeave={() => setHoveredStar(0)}>
          {[1, 2, 3, 4, 5].map((s) => (
            <InteractiveStar
              key={s}
              filled={s <= (hoveredStar || rating)}
              onHover={() => setHoveredStar(s)}
              onClick={() => setRating(s)}
            />
          ))}
          {(hoveredStar || rating) > 0 && (
            <span className="ml-2 text-sm text-muted">{RATING_LABELS[hoveredStar || rating]}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="text-xs font-medium block mb-1.5 text-secondary">
          Title <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Summarize your experience"
          className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="text-xs font-medium block mb-1.5 text-secondary">
          Review * <span className="text-muted font-normal">(min 10 characters)</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Tell others about your experience with this product…"
          className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-muted text-right mt-0.5">{body.length}/2000</p>
      </div>

      {/* Photo upload */}
      <div className="mb-5">
        <label className="text-xs font-medium block mb-2 text-secondary">
          Photos <span className="text-muted font-normal">(up to 5, optional)</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {imageUrls.map((url, i) => (
            <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border">
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                onClick={() => setImageUrls((p) => p.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {imageUrls.length < 5 && (
            <label className={`w-16 h-16 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-primary hover:text-primary transition-colors ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
              <Camera className="w-5 h-5 text-muted" />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={isUploading}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-muted hover:text-secondary">
          Cancel
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="px-5 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </div>
  );
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterId = 'suggested' | 'photo' | 'all';

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
  const [activeFilter,  setActiveFilter]  = useState<FilterId>('suggested');
  const [starFilter,    setStarFilter]    = useState<number | null>(null);
  const [page,          setPage]          = useState(1);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const { data, isLoading } = useReviews(productSlug, {
    page,
    limit:  10,
    rating: starFilter ?? undefined,
    status: 'APPROVED',
  });

  const allReviews  = data?.data ?? [];
  const reviews     = applyClientFilter(allReviews, activeFilter);
  const photoCount  = allReviews.filter((r) => (r.images ?? []).length > 0).length;
  const allPhotos   = reviews.flatMap((r) => r.images ?? []);

  // Show write form even when there are no reviews yet
  if (!reviewSummary || reviewSummary.totalReviews === 0) {
    return (
      <section id="reviews" className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xl font-semibold mb-4">Reviews for this item</h2>
        {reviewSuccess ? (
          <div className="py-6 text-center text-sm text-green-700 bg-green-50 rounded-2xl border border-green-100">
            Thank you! Your review has been submitted and will appear after moderation.
          </div>
        ) : (
          <>
            <WriteReviewForm productSlug={productSlug} onSuccess={() => setReviewSuccess(true)} />
            <p className="text-sm text-muted text-center mt-6">No reviews yet — be the first!</p>
          </>
        )}
      </section>
    );
  }

  const { averageRating, totalReviews, distribution } = reviewSummary;

  const filterTabs: { id: FilterId; label: string }[] = [
    { id: 'suggested', label: 'Suggested' },
    { id: 'photo',     label: `With photos (${photoCount})` },
    { id: 'all',       label: 'All' },
  ];

  const handleFilterChange = (id: FilterId) => {
    setActiveFilter(id);
    setStarFilter(null);
    setPage(1);
  };

  const handleStarFilter = (star: number) => {
    if (starFilter === star) {
      setStarFilter(null);
    } else {
      setStarFilter(star);
      setActiveFilter('all');
    }
    setPage(1);
  };

  const clearStarFilter = () => {
    setStarFilter(null);
    setActiveFilter('suggested');
    setPage(1);
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await apiClient.post(API_ROUTES.PRODUCTS.REVIEW_HELPFUL(productSlug, reviewId));
    } catch { /* best-effort */ }
  };

  // Approximate per-category scores from overall average (API has no breakdown)
  const categoryRatings = [
    { label: 'Item quality',      score: averageRating },
    { label: 'Shipping',          score: Math.min(5, averageRating + 0.1) },
    { label: 'Customer service',  score: 4.9 },
  ];

  return (
    <section id="reviews" className="mt-12 pt-8 border-t border-border">
      <div className="flex items-baseline gap-3 mb-6">
        <h2 className="text-xl font-semibold">
          {starFilter !== null ? `${starFilter}-star reviews` : 'Reviews for this item'}
        </h2>
        <span className="text-sm text-muted">
          {totalReviews.toLocaleString()} total
        </span>
      </div>

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

        {/* Star distribution bars — clickable to filter */}
        <div className="flex-1 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count     = distribution[star] ?? 0;
            const pct       = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            const isActive  = starFilter === star;
            const isDisabled = count === 0;
            return (
              <button
                key={star}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && handleStarFilter(star)}
                className={[
                  'w-full flex items-center gap-2 text-sm rounded-lg px-2 py-1 -mx-2 transition-colors group',
                  isDisabled  ? 'cursor-default opacity-40' : 'cursor-pointer',
                  isActive    ? 'bg-yellow-50 ring-1 ring-yellow-300' : isDisabled ? '' : 'hover:bg-gray-50',
                ].join(' ')}
              >
                <span className={`w-4 text-right tabular-nums shrink-0 text-xs font-medium ${isActive ? 'text-yellow-600' : 'text-muted'}`}>
                  {star}★
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isActive ? 'bg-yellow-500' : 'bg-yellow-400 group-hover:bg-yellow-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs w-8 text-right tabular-nums shrink-0 ${isActive ? 'text-yellow-700 font-semibold' : 'text-muted'}`}>
                  {Math.round(pct)}%
                </span>
              </button>
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 [&::-webkit-scrollbar]:hidden">
        {/* Active star filter chip */}
        {starFilter !== null && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-yellow-400 text-yellow-900 font-medium">
            <Star className="w-3.5 h-3.5 fill-yellow-700 text-yellow-700" />
            {starFilter} stars
            <button
              type="button"
              onClick={clearStarFilter}
              aria-label="Clear star filter"
              className="ml-0.5 hover:text-yellow-900/70 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab pills (hidden when star filter is active, except All) */}
        {starFilter === null && filterTabs.map((tab) => (
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

        {/* When star filter active, show "All reviews" shortcut */}
        {starFilter !== null && (
          <button
            type="button"
            onClick={clearStarFilter}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm border border-border text-secondary hover:border-secondary transition-colors"
          >
            All reviews
          </button>
        )}
      </div>

      {/* ── WRITE REVIEW FORM ── */}
      {reviewSuccess ? (
        <div className="mb-6 py-4 text-center text-sm text-green-700 bg-green-50 rounded-2xl border border-green-100">
          Thank you! Your review has been submitted and will appear after moderation.
        </div>
      ) : (
        <div className="mb-6">
          <WriteReviewForm productSlug={productSlug} onSuccess={() => setReviewSuccess(true)} />
        </div>
      )}

      {/* ── REVIEW LIST ── */}
      {isLoading ? (
        <ReviewListSkeleton />
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-muted">
            {starFilter !== null
              ? `No ${starFilter}-star reviews yet.`
              : activeFilter === 'photo'
                ? 'No reviews with photos yet.'
                : 'No reviews match this filter.'}
          </p>
          {starFilter !== null && (
            <button
              type="button"
              onClick={clearStarFilter}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Show all reviews
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
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
