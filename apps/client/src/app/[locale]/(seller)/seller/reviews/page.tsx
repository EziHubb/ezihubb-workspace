'use client';

import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';

interface SellerReview {
  id:          string;
  rating:      number;
  title:       string | null;
  body:        string | null;
  productName: string;
  reviewerName: string;
  createdAt:   string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
      ))}
    </div>
  );
}

export default function SellerReviewsPage() {
  const token = useAuthStore((s) => s.accessToken);

  const { data: reviews = [], isLoading } = useQuery<SellerReview[]>({
    queryKey: ['seller-reviews'],
    queryFn:  () => apiClient.get<SellerReview[]>('/seller/reviews', { token: token ?? undefined }),
    enabled:  !!token,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-secondary">Reviews</h1>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-20 bg-border/20 rounded animate-pulse" />)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-14 text-center">
            <Star className="w-10 h-10 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">No reviews yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id} className="p-5 space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {r.title && <p className="text-sm font-semibold text-secondary">{r.title}</p>}
                {r.body  && <p className="text-sm text-muted line-clamp-3">{r.body}</p>}
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-secondary">{r.reviewerName}</span>
                  <span>·</span>
                  <span>{r.productName}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
