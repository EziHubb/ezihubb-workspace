'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Star, Sparkles, Award, Heart, Truck, Check, ThumbsUp, Camera, X,
} from 'lucide-react';
import { useReviews } from '@ezihubb/api-client';
import { apiClient, apiFetch } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@ezihubb/api-client';
import type { ReviewDto, ReviewSummaryDto } from '@ezihubb/types';
import { fmtRating, safeNum } from '@ezihubb/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
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

type Translator = ReturnType<typeof useTranslations>;

function useBadgeDefs(t: Translator) {
  return [
    { Icon: Sparkles, label: t('badges.looksGreat'),   minRating: 4.5 },
    { Icon: Award,    label: t('badges.quality'),      minRating: 0 },
    { Icon: Heart,    label: t('badges.loveIt'),        minRating: 4.8 },
    { Icon: Truck,    label: t('badges.fastShipping'), minRating: 0 },
    { Icon: Check,    label: t('badges.asDescribed'),  minRating: 0 },
  ] as const;
}

function SentimentBadges({ averageRating }: { averageRating: number }) {
  const t = useTranslations('product.etsyReviews');
  const badgeDefs = useBadgeDefs(t);
  const active = badgeDefs.filter((b) => averageRating >= b.minRating);
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
  const t = useTranslations('product.etsyReviews');
  const locale = useLocale();
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
          {isExpanded ? t('showLess') : t('readMore')}
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
                alt={t('reviewPhoto', { n: i + 1 })}
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
            {fmtDate(review.createdAt, locale)}
          </time>
        </div>
      </div>

      {/* Admin reply */}
      {review.adminReply && (
        <div className="mt-3 pl-3 border-l-2 border-border">
          <p className="text-xs font-semibold text-secondary">
            {t('responseFrom')}
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
          {markedHelpful ? t('markedAsHelpful') : t('helpfulQuestion')}
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
  const t            = useTranslations('product.etsyReviews');
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
  // Preview URLs (blob:) for what the shopper sees before submitting, and the
  // actual Files kept alongside them. Both are needed: a blob: URL cannot be
  // uploaded, and a File cannot be rendered in an <img> without one.
  const [imageUrls,   setImageUrls]   = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // No ''uploading'' state here any more: selecting a file only stages it, which
  // is synchronous. The actual upload happens at submit and is covered by
  // isSubmitting, so a spinner on the picker would never be true.
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

  // Photos are attached AFTER the review exists, because the upload endpoint is
  // POST /reviews/:reviewId/images — it needs an id to attach to. So selecting a
  // file here only stages it; nothing is sent until submit.
  //
  // This previously built a FormData, appended the file, and then never sent it
  // anywhere — only the blob: preview was kept. The shopper saw their photos
  // "attached" and they were silently discarded on submit, and lost entirely on
  // reload, since a blob: URL does not outlive the page.
  const handleFiles = (files: FileList) => {
    const room = 5 - pendingFiles.length;
    if (room <= 0) return;

    const accepted: File[] = [];
    const previews: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      // Mirrors the server's own limits (reviews.controller.ts) so a file that
      // would be rejected is caught before the shopper writes a whole review.
      if (file.size > REVIEW_IMAGE_MAX_BYTES) continue;
      if (!REVIEW_IMAGE_TYPES.includes(file.type)) continue;
      accepted.push(file);
      previews.push(URL.createObjectURL(file));
    }
    if (!accepted.length) return;

    setPendingFiles((prev) => [...prev, ...accepted]);
    setImageUrls((prev) => [...prev, ...previews]);
  };

  const removeImage = (i: number) => {
    // blob: URLs are held by the document until revoked; dropping the state
    // reference alone leaks the decoded image for the life of the page.
    const url = imageUrls[i];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setImageUrls((p) => p.filter((_, j) => j !== i));
    setPendingFiles((p) => p.filter((_, j) => j !== i));
  };

  const handleSubmit = async () => {
    if (rating === 0)       return setError(t('pleaseSelectRating'));
    if (body.length < 10)   return setError(t('reviewTooShort'));
    if (!orderId)           return setError(t('pleaseSelectOrder'));
    setError('');
    setIsSubmitting(true);
    try {
      const created = await apiClient.post<{ id: string }>(
        API_ROUTES.PRODUCTS.REVIEWS(productSlug),
        { orderId, rating, title: title || undefined, body },
        { token: accessToken ?? undefined },
      );

      // Attach staged photos to the review that now exists. Sent through
      // apiFetch rather than apiClient: apiClient JSON.stringify's every body,
      // so it cannot carry multipart at all.
      //
      // A failed photo upload does NOT fail the submit — the review itself is
      // already saved, and throwing here would show an error for something that
      // did succeed, and invite a resubmit that would duplicate it.
      if (created?.id && pendingFiles.length) {
        const form = new FormData();
        // Field name must be "images": FilesInterceptor('images', 5).
        for (const file of pendingFiles) form.append('images', file);
        try {
          await apiFetch(API_ROUTES.REVIEWS.UPLOAD_IMAGES(created.id), {
            method: 'POST',
            body: form as unknown as BodyInit,
          });
        } catch {
          setError(t('photosFailedButReviewSaved'));
        }
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews(productSlug, {}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewSummary(productSlug) });
      setIsOpen(false);
      setRating(0); setTitle(''); setBody(''); setOrderId('');
      imageUrls.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
      setImageUrls([]); setPendingFiles([]);
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? t('failedToSubmit');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mt-4 py-4 border border-dashed border-border rounded-2xl text-center">
        <p className="text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline font-medium">{t('signIn')}</Link>{' '}
          {t('toWriteReview')}
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
        {t('writeAReview')}
      </button>
    );
  }

  return (
    <div className="mt-4 border border-border rounded-2xl p-5 bg-[#FAFAF8]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-secondary">{t('writeAReview')}</h4>
        <button type="button" onClick={() => setIsOpen(false)} className="text-muted hover:text-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Order selector */}
      {reviewables.length > 1 && (
        <div className="mb-4">
          <label className="text-xs font-medium block mb-1.5 text-secondary">{t('order')}</label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('selectOrder')}</option>
            {reviewables.map((r) => (
              <option key={r.orderId} value={r.orderId}>{t('orderNumber', { number: r.orderNumber })}</option>
            ))}
          </select>
        </div>
      )}

      {/* Star rating */}
      <div className="mb-4">
        <label className="text-xs font-medium block mb-2 text-secondary">{t('rating')}</label>
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
            <span className="ml-2 text-sm text-muted">{t(`ratingLabels.${hoveredStar || rating}` as 'ratingLabels.1')}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="text-xs font-medium block mb-1.5 text-secondary">
          {t('title')} <span className="text-muted font-normal">{t('optional')}</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={t('titlePlaceholder')}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="text-xs font-medium block mb-1.5 text-secondary">
          {t('review')} <span className="text-muted font-normal">{t('minChars')}</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t('reviewPlaceholder')}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-muted text-right mt-0.5">{body.length}/2000</p>
      </div>

      {/* Photo upload */}
      <div className="mb-5">
        <label className="text-xs font-medium block mb-2 text-secondary">
          {t('photos')} <span className="text-muted font-normal">{t('upTo5Optional')}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {imageUrls.map((url, i) => (
            <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border">
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {imageUrls.length < 5 && (
            <label className={`w-16 h-16 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-primary hover:text-primary transition-colors`}>
              <Camera className="w-5 h-5 text-muted" />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={imageUrls.length >= 5}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-muted hover:text-secondary">
          {t('cancel')}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="px-5 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? t('submitting') : t('submitReview')}
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

/** Mirrors MAX_IMAGE_SIZE / ALLOWED_IMAGE_TYPES in reviews.controller.ts. */
const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function EtsyReviewsSection({ productSlug, reviewSummary }: Props) {
  const t = useTranslations('product.etsyReviews');
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
        <h2 className="text-xl font-semibold mb-4">{t('reviewsForThisItem')}</h2>
        {reviewSuccess ? (
          <div className="py-6 text-center text-sm text-green-700 bg-green-50 rounded-2xl border border-green-100">
            {t('thankYouSubmitted')}
          </div>
        ) : (
          <>
            <WriteReviewForm productSlug={productSlug} onSuccess={() => setReviewSuccess(true)} />
            <p className="text-sm text-muted text-center mt-6">{t('noReviewsBeFirst')}</p>
          </>
        )}
      </section>
    );
  }

  const { averageRating, totalReviews, distribution } = reviewSummary;

  const filterTabs: { id: FilterId; label: string }[] = [
    { id: 'suggested', label: t('suggested') },
    { id: 'photo',     label: t('withPhotos', { count: photoCount }) },
    { id: 'all',       label: t('all') },
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
    { label: t('itemQuality'),     score: averageRating },
    { label: t('shipping'),        score: Math.min(5, averageRating + 0.1) },
    { label: t('customerService'), score: 4.9 },
  ];

  return (
    <section id="reviews" className="mt-12 pt-8 border-t border-border">
      <div className="flex items-baseline gap-3 mb-6">
        <h2 className="text-xl font-semibold">
          {starFilter !== null ? t('starReviews', { star: starFilter }) : t('reviewsForThisItem')}
        </h2>
        <span className="text-sm text-muted">
          {t('total', { count: safeNum(totalReviews).toLocaleString() })}
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
              {fmtRating(averageRating)}
            </div>
            <div className="flex justify-center mt-1">
              <Stars rating={averageRating} />
            </div>
            <p className="text-xs text-muted mt-1">
              {t('reviewCount', { count: safeNum(totalReviews) })}
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
                  {fmtRating(cat.score)}
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
            {t('stars', { star: starFilter })}
            <button
              type="button"
              onClick={clearStarFilter}
              aria-label={t('clearStarFilter')}
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
            {t('allReviews')}
          </button>
        )}
      </div>

      {/* ── WRITE REVIEW FORM ── */}
      {reviewSuccess ? (
        <div className="mb-6 py-4 text-center text-sm text-green-700 bg-green-50 rounded-2xl border border-green-100">
          {t('thankYouSubmitted')}
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
              ? t('noStarReviews', { star: starFilter })
              : activeFilter === 'photo'
                ? t('noPhotoReviews')
                : t('noFilterReviews')}
          </p>
          {starFilter !== null && (
            <button
              type="button"
              onClick={clearStarFilter}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {t('showAllReviews')}
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
          <h3 className="text-sm font-medium text-secondary mb-3">{t('photosFromReviews')}</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {allPhotos.slice(0, 10).map((url, i) => (
              <div
                key={i}
                className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-background cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Image
                  src={url}
                  alt={t('customerPhoto', { n: i + 1 })}
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
          {t('viewAllReviews')}
        </button>
      )}
    </section>
  );
}
