'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clientFetch } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewDto {
  id:          string;
  rating:      number;
  authorName:  string;
  productName: string;
  createdAt:   string;
}

// ── Star row ──────────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-border fill-border'}`}
        />
      ))}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PendingReviewsCardProps {
  initialReviews: ReviewDto[];
  totalPending:   number;
}

export function PendingReviewsCard({
  initialReviews,
  totalPending,
}: PendingReviewsCardProps) {
  const [reviews, setReviews] = useState<ReviewDto[]>(initialReviews);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const handleAction = async (id: string, action: 'approve' | 'hide') => {
    const endpoint = action === 'approve'
      ? `/admin/reviews/${id}/approve`
      : `/admin/reviews/${id}/hide`;

    setPending((p) => new Set(p).add(id));
    try {
      await clientFetch(endpoint, { method: 'PATCH' });
      // Fade-out by removing with a small delay
      setTimeout(() => {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        setPending((p) => { const n = new Set(p); n.delete(id); return n; });
      }, 250);
    } catch {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  return (
    <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h5 className="font-semibold text-secondary text-sm">Reviews to Approve</h5>
          {totalPending > 0 && (
            <span className="bg-primary/10 text-primary text-[10px] font-bold rounded-pill px-2 py-0.5">
              {totalPending} pending
            </span>
          )}
        </div>
        <Link href="/reviews" className="text-xs text-primary hover:underline font-medium">
          View all →
        </Link>
      </div>

      {/* Review rows */}
      <ul className="divide-y divide-border">
        {reviews.length === 0 ? (
          <li className="px-5 py-10 text-center text-muted text-sm">
            No reviews pending — you&apos;re all caught up! 🎉
          </li>
        ) : (
          reviews.map((review) => {
            const isProcessing = pending.has(review.id);
            return (
              <li
                key={review.id}
                className={`flex items-center gap-3 px-5 py-3 min-h-[52px] transition-all duration-200 ${
                  isProcessing ? 'opacity-30' : 'opacity-100'
                }`}
              >
                {/* Stars */}
                <StarRow rating={review.rating} />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">
                    {review.authorName}
                  </p>
                  <p className="text-xs text-muted truncate">{review.productName}</p>
                </div>

                {/* Date */}
                <span className="text-xs text-muted whitespace-nowrap shrink-0">
                  {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                </span>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAction(review.id, 'approve')}
                    aria-label="Approve review"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAction(review.id, 'hide')}
                    aria-label="Hide review"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-muted/10 text-muted hover:bg-muted/20 disabled:opacity-40 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
