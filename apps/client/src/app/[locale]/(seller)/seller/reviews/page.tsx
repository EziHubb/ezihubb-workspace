'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@mlh/api-client';

interface ReviewItem {
  id:              string;
  rating:          number;
  title?:          string | null;
  body:            string;
  status:          string;
  sellerReply?:    string | null;
  sellerRepliedAt?:string | null;
  createdAt:       string;
  author:          { firstName?: string | null; lastName?: string | null };
}

interface ReviewsResponse {
  data:       ReviewItem[];
  pagination: { page: number; total: number; totalPages: number };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-muted'}`}
        />
      ))}
    </div>
  );
}

export default function SellerReviewsPage() {
  const qc   = useQueryClient();
  const [page, setPage]           = useState(1);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText]   = useState('');

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ['seller', 'reviews', page],
    queryFn:  () => api.get<ReviewsResponse>(`/seller/reviews?page=${page}&limit=20`),
    staleTime: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      api.post(`/seller/reviews/${id}/reply`, { reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'reviews'] });
      setReplyingTo(null);
      setReplyText('');
    },
  });

  const reviews    = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Reviews</h1>
        <p className="text-sm text-muted mt-0.5">{pagination?.total ?? 0} reviews for your store</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/10 rounded-card animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-12 text-center">
          <Star className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="font-medium text-secondary">No reviews yet</p>
          <p className="text-sm text-muted mt-1">Customer reviews will appear here once your products receive feedback.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const authorName = [review.author.firstName, review.author.lastName].filter(Boolean).join(' ') || 'Customer';
            return (
              <div key={review.id} className="border border-border rounded-card p-5 bg-background">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <StarRating rating={review.rating} />
                      {review.title && (
                        <span className="text-sm font-semibold text-secondary">{review.title}</span>
                      )}
                      <span className="text-xs text-muted ml-auto">
                        {format(new Date(review.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-secondary">{review.body}</p>
                    <p className="text-xs text-muted mt-1">— {authorName}</p>
                  </div>
                </div>

                {review.sellerReply && (
                  <div className="mt-3 pl-4 border-l-2 border-primary/20">
                    <p className="text-xs font-semibold text-primary mb-1">Your reply</p>
                    <p className="text-sm text-secondary">{review.sellerReply}</p>
                    {review.sellerRepliedAt && (
                      <p className="text-xs text-muted mt-0.5">
                        {format(new Date(review.sellerRepliedAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                )}

                {!review.sellerReply && replyingTo !== review.id && (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(review.id)}
                    className="mt-3 text-xs font-medium text-primary hover:underline"
                  >
                    Reply to this review
                  </button>
                )}

                {replyingTo === review.id && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a public reply to this review..."
                      rows={3}
                      className="w-full text-sm border border-border rounded-button p-3 focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!replyText.trim() || replyMutation.isPending}
                        onClick={() => replyMutation.mutate({ id: review.id, reply: replyText.trim() })}
                        className="text-sm font-bold bg-primary text-white px-4 py-2 rounded-button hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {replyMutation.isPending ? 'Posting…' : 'Post Reply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                        className="text-sm text-muted hover:text-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm px-3 py-1.5 border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {pagination.totalPages}</span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm px-3 py-1.5 border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
