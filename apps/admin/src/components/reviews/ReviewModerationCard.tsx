'use client';

import Image from 'next/image';
import { fmtDateTime, fmtDate } from '../../lib/fmt';
import { Check, EyeOff, MessageSquare, Trash2, Package, BadgeCheck } from 'lucide-react';

// ── Types (exported for page to share) ───────────────────────────────────────

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export interface Review {
  id:                string;
  userId:            string;
  customerName:      string;
  customerEmail:     string;
  customerAvatarUrl?: string;
  productId:         string;
  productName:       string;
  productImageUrl?:  string;
  productSlug:       string;
  categoryName?:     string;
  orderId:           string;
  rating:            number;
  title?:            string;
  body:              string;
  imageUrls:         string[];
  status:            ReviewStatus;
  adminReply?:       string;
  repliedAt?:        string;
  createdAt:         string;
}

// ── Star row ─────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-amber-400' : 'text-border'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ReviewStatus, { label: string; cls: string }> = {
  PENDING:  { label: '⏳ Pending',  cls: 'bg-amber-100 text-amber-700'  },
  APPROVED: { label: '✅ Approved', cls: 'bg-green-100 text-green-700'  },
  HIDDEN:   { label: '🙈 Hidden',   cls: 'bg-gray-100 text-gray-600'    },
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const { label, cls } = STATUS_CFG[status];
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-pill ${cls}`}>{label}</span>;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function CustomerAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
      {initials || '?'}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface ReviewModerationCardProps {
  review:         Review;
  activeTab:      'PENDING' | 'APPROVED' | 'HIDDEN' | 'ALL';
  selected:       boolean;
  onToggleSelect: (id: string) => void;
  onApprove:      (id: string) => void;
  onHide:         (id: string) => void;
  onDelete:       (id: string) => void;
  onReply:        (review: Review) => void;
  loading?:       string | null;
}

export function ReviewModerationCard({
  review,
  activeTab,
  selected,
  onToggleSelect,
  onApprove,
  onHide,
  onDelete,
  onReply,
  loading,
}: ReviewModerationCardProps) {
  const truncateBody = activeTab !== 'PENDING' && activeTab !== 'ALL';
  const isLoading    = loading === review.id;

  return (
    <div
      className={[
        'bg-surface rounded-card border shadow-card transition-all',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-primary/30',
        isLoading ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      {/* ── Header row ───────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(review.id)}
          className="w-4 h-4 accent-primary rounded mt-0.5 shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Avatar */}
        <CustomerAvatar name={review.customerName} avatarUrl={review.customerAvatarUrl} />

        {/* Name + verified + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-secondary text-sm">{review.customerName}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
              <BadgeCheck className="w-3 h-3" />
              Verified Purchase
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{review.customerEmail}</p>
          <p className="text-[11px] text-muted/70 mt-0.5">
            {fmtDateTime(review.createdAt)}
          </p>
        </div>

        {/* Status badge */}
        <StatusBadge status={review.status} />
      </div>

      {/* ── Product row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mx-4 px-3 py-2 bg-background rounded-button border border-border mb-3">
        {review.productImageUrl ? (
          <Image
            src={review.productImageUrl}
            alt={review.productName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-muted" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-secondary truncate">{review.productName}</p>
          {review.categoryName && (
            <p className="text-xs text-muted mt-0.5">{review.categoryName}</p>
          )}
        </div>
      </div>

      {/* ── Rating + Title ────────────────────────────────────────────────── */}
      <div className="px-4 mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Stars rating={review.rating} />
          <span className="text-xs font-semibold text-secondary tabular-nums">{review.rating}/5</span>
        </div>
        {review.title && (
          <h5 className="font-semibold text-secondary text-sm">{review.title}</h5>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <p
          className={[
            'text-sm text-secondary leading-relaxed',
            truncateBody ? 'line-clamp-3' : '',
          ].join(' ')}
        >
          {review.body}
        </p>
      </div>

      {/* ── Photo strip ──────────────────────────────────────────────────── */}
      {review.imageUrls.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-3 flex-wrap">
          {review.imageUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <Image
                src={url}
                alt={`Review photo ${i + 1}`}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity"
              />
            </a>
          ))}
        </div>
      )}

      {/* ── Admin reply (if exists) ───────────────────────────────────────── */}
      {review.adminReply && (
        <div className="mx-4 mb-3 pl-3 border-l-2 border-primary/30 bg-primary/3 rounded-r-button p-2.5">
          <p className="text-[11px] font-semibold text-primary mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            MapleLoomHandmade replied
            {review.repliedAt && (
              <span className="font-normal text-muted ml-1">
                · {fmtDate(review.repliedAt)}
              </span>
            )}
          </p>
          <p className="text-xs text-secondary leading-relaxed">{review.adminReply}</p>
        </div>
      )}

      {/* ── Action row ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-wrap">
        {review.status !== 'APPROVED' && (
          <button
            type="button"
            onClick={() => onApprove(review.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-button transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Approve
          </button>
        )}

        {review.status !== 'HIDDEN' && (
          <button
            type="button"
            onClick={() => onHide(review.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface border border-border text-secondary hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-button transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Hide
          </button>
        )}

        <button
          type="button"
          onClick={() => onReply(review)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border text-muted hover:border-primary/40 hover:text-primary rounded-button transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {review.adminReply ? 'Edit Reply' : 'Reply'}
        </button>

        <button
          type="button"
          onClick={() => onDelete(review.id)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted hover:text-red-600 hover:bg-red-50 rounded-button transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
