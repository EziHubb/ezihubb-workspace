'use client';

import { useState, useEffect } from 'react';
import { X, Check, EyeOff, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import { fmtDate } from '../../lib/fmt';
import type { Review } from './ReviewModerationCard';

// ── Star (inline to avoid import cycle) ──────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400' : 'text-border'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReviewReplyModalProps {
  review:    Review;
  onClose:   () => void;
  onSubmit:  (replyText: string, statusChange?: 'APPROVED' | 'HIDDEN') => Promise<void>;
  onApprove: (id: string) => void;
  onHide:    (id: string) => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ReviewReplyModal({
  review,
  onClose,
  onSubmit,
  onApprove,
  onHide,
}: ReviewReplyModalProps) {
  const [replyText, setReplyText] = useState(review.adminReply ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [charCount, setCharCount] = useState(review.adminReply?.length ?? 0);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleReplyChange = (v: string) => {
    setReplyText(v);
    setCharCount(v.length);
  };

  const handlePublish = async (statusChange?: 'APPROVED' | 'HIDDEN') => {
    if (!replyText.trim()) { setError('Reply text cannot be empty'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(replyText.trim(), statusChange);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to publish reply');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAndPublish = async () => {
    if (!replyText.trim()) { onApprove(review.id); onClose(); return; }
    await handlePublish('APPROVED');
  };

  const handleHideAndPublish = async () => {
    if (!replyText.trim()) { onHide(review.id); onClose(); return; }
    await handlePublish('HIDDEN');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="relative bg-surface rounded-card border border-border shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 sticky top-0 bg-surface z-10">
            <h2 className="font-bold text-secondary text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Reply to Review
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 flex-1">
            {/* Review recap */}
            <div className="bg-[#F9FAFB] border border-border rounded-card p-4 space-y-3">
              {/* Customer + rating */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-secondary text-sm">{review.customerName}</p>
                  <p className="text-xs text-muted">{review.customerEmail}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Stars rating={review.rating} />
                  <span className="text-xs text-muted">{fmtDate(review.createdAt)}</span>
                </div>
              </div>

              {/* Product */}
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-medium text-secondary">{review.productName}</span>
                {review.categoryName && <span>· {review.categoryName}</span>}
              </div>

              {/* Review title + body */}
              {review.title && (
                <p className="font-semibold text-secondary text-sm">{review.title}</p>
              )}
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {review.body}
              </p>

              {/* Photos */}
              {review.imageUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {review.imageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={url}
                        alt={`Photo ${i + 1}`}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Reply section */}
            <div>
              <h5 className="font-semibold text-secondary text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">M</span>
                </span>
                Reply as MapleLoomHandmade
              </h5>

              <textarea
                value={replyText}
                onChange={(e) => handleReplyChange(e.target.value)}
                rows={5}
                placeholder="Write a thoughtful reply to this customer's review…"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted resize-none leading-relaxed"
                style={{ minHeight: '120px' }}
                maxLength={1000}
              />

              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-muted">
                  This reply will be publicly visible below the review.
                </p>
                <span className={`text-[11px] tabular-nums ${charCount > 900 ? 'text-amber-600' : 'text-muted'}`}>
                  {charCount}/1000
                </span>
              </div>

              {error && (
                <p className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded-button px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center gap-3 shrink-0">
            {/* Left: Quick status actions */}
            <div className="flex items-center gap-2 mr-auto">
              {review.status !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={handleApproveAndPublish}
                  disabled={saving}
                  title={replyText.trim() ? 'Approve and publish reply' : 'Approve this review'}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-button transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve{replyText.trim() ? ' & Reply' : ''}
                </button>
              )}
              {review.status !== 'HIDDEN' && (
                <button
                  type="button"
                  onClick={handleHideAndPublish}
                  disabled={saving}
                  title={replyText.trim() ? 'Hide and publish reply' : 'Hide this review'}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border text-muted hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-button transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide{replyText.trim() ? ' & Reply' : ''}
                </button>
              )}
            </div>

            {/* Right: Cancel / Publish */}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handlePublish()}
              disabled={saving || !replyText.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              {saving ? 'Publishing…' : 'Publish Reply'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
