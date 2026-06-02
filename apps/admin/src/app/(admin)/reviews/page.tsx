'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, ChevronLeft, ChevronRight, Check, EyeOff } from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import {
  ReviewModerationCard,
  type Review,
} from '../../../components/reviews/ReviewModerationCard';
import { ReviewReplyModal } from '../../../components/reviews/ReviewReplyModal';
import { clientFetch } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabValue = 'PENDING' | 'APPROVED' | 'HIDDEN' | 'ALL';

interface ReviewCounts {
  PENDING:  number;
  APPROVED: number;
  HIDDEN:   number;
  ALL:      number;
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS: { value: TabValue; label: string; icon: string }[] = [
  { value: 'PENDING',  label: 'Pending',  icon: '⏳' },
  { value: 'APPROVED', label: 'Approved', icon: '✅' },
  { value: 'HIDDEN',   label: 'Hidden',   icon: '🙈' },
  { value: 'ALL',      label: 'All',      icon: '📋' },
];

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-4 bg-muted/10 rounded" />
        <div className="w-9 h-9 bg-muted/10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-muted/10 rounded w-1/3" />
          <div className="h-3 bg-muted/10 rounded w-1/4" />
        </div>
        <div className="w-20 h-6 bg-muted/10 rounded-pill" />
      </div>
      <div className="h-10 bg-muted/10 rounded-button mb-3" />
      <div className="flex gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-4 h-4 bg-muted/10 rounded" />)}
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-muted/10 rounded w-full" />
        <div className="h-3 bg-muted/10 rounded w-3/4" />
        <div className="h-3 bg-muted/10 rounded w-5/6" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

export default function ReviewsPage() {
  const qc = useQueryClient();

  const [tab,          setTab]          = useState<TabValue>('PENDING');
  const [page,         setPage]         = useState(1);
  const [rating,       setRating]       = useState<number | ''>('');
  const [search,       setSearch]       = useState('');
  const [debouncedQ,   setDebouncedQ]   = useState('');
  const [loadingId,    setLoadingId]    = useState<string | null>(null);
  const [replyTarget,  setReplyTarget]  = useState<Review | null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkLoading,  setBulkLoading]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset selection on tab change
  useEffect(() => { setSelected(new Set()); setPage(1); }, [tab]);

  // ── Counts query ──────────────────────────────────────────────────────────

  const countsQuery = useQuery<ReviewCounts>({
    queryKey: ['review-counts'],
    queryFn:  async () => {
      const res  = await clientFetch('/admin/reviews/counts');
      const body = await res.json();
      return (body.data ?? body) as ReviewCounts;
    },
    staleTime: 30_000,
  });
  const counts = countsQuery.data;

  // ── Reviews query ─────────────────────────────────────────────────────────

  const listKey = ['admin-reviews', tab, page, rating, debouncedQ];

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (tab !== 'ALL') p.set('status', tab);
      if (rating)        p.set('rating', String(rating));
      if (debouncedQ)    p.set('q',      debouncedQ);
      const res  = await clientFetch(`/admin/reviews?${p}`);
      const body = await res.json();
      return body as { data: Review[]; total: number };
    },
  });

  const reviews    = listQuery.data?.data ?? [];
  const total      = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    qc.invalidateQueries({ queryKey: ['review-counts'] });
  }, [qc]);

  // ── Single actions ─────────────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    setLoadingId(id);
    try {
      await clientFetch(`/admin/reviews/${id}/approve`, { method: 'POST' });
      invalidate();
    } finally { setLoadingId(null); }
  };

  const handleHide = async (id: string) => {
    setLoadingId(id);
    try {
      await clientFetch(`/admin/reviews/${id}/hide`, { method: 'POST' });
      invalidate();
    } finally { setLoadingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this review? This cannot be undone.')) return;
    setLoadingId(id);
    try {
      await clientFetch(`/admin/reviews/${id}`, { method: 'DELETE' });
      invalidate();
    } finally { setLoadingId(null); }
  };

  const handleReplySubmit = async (replyText: string, statusChange?: 'APPROVED' | 'HIDDEN') => {
    if (!replyTarget) return;
    await clientFetch(`/admin/reviews/${replyTarget.id}/reply`, {
      method: 'POST',
      body:   JSON.stringify({ reply: replyText }),
    });
    if (statusChange === 'APPROVED') await clientFetch(`/admin/reviews/${replyTarget.id}/approve`, { method: 'POST' });
    if (statusChange === 'HIDDEN')   await clientFetch(`/admin/reviews/${replyTarget.id}/hide`,    { method: 'POST' });
    invalidate();
    setReplyTarget(null);
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (selected.size === reviews.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviews.map((r) => r.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) =>
        clientFetch(`/admin/reviews/${id}/approve`, { method: 'POST' })
      ));
      invalidate();
      clearSelection();
    } finally { setBulkLoading(false); }
  };

  const handleBulkHide = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) =>
        clientFetch(`/admin/reviews/${id}/hide`, { method: 'POST' })
      ));
      invalidate();
      clearSelection();
    } finally { setBulkLoading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Reviews"
        subtitle="Moderate customer reviews and manage public replies"
      />

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="border-b border-border mb-5">
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const count = counts?.[t.value];
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={[
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-secondary hover:border-border',
                ].join(' ')}
              >
                <span>{t.icon}</span>
                {t.label}
                {count != null && (
                  <span
                    className={[
                      'text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                      active
                        ? 'bg-primary/10 text-primary'
                        : t.value === 'PENDING' && count > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-muted/10 text-muted',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Rating */}
        <select
          value={rating}
          onChange={(e) => { setRating(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Rating ▾</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{'⭐'.repeat(r)} {r} star{r !== 1 ? 's' : ''}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or customer…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <p className="ml-auto text-xs text-muted">{total} review{total !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-button">
          <input
            type="checkbox"
            checked={selected.size === reviews.length && reviews.length > 0}
            onChange={toggleAll}
            className="w-4 h-4 accent-primary rounded"
          />
          <span className="text-sm font-semibold text-primary">
            {selected.size} selected
          </span>

          <div className="flex items-center gap-2 ml-2">
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-button transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {bulkLoading ? 'Processing…' : 'Approve All Selected'}
            </button>
            <button
              type="button"
              onClick={handleBulkHide}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-button transition-colors disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide All Selected
            </button>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs text-muted hover:text-secondary flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Clear selection
          </button>
        </div>
      )}

      {/* Select-all row (when no selection yet) */}
      {selected.size === 0 && reviews.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <input
            type="checkbox"
            checked={false}
            onChange={toggleAll}
            className="w-4 h-4 accent-primary rounded cursor-pointer"
          />
          <label className="text-xs text-muted cursor-pointer" onClick={toggleAll}>
            Select all on this page
          </label>
        </div>
      )}

      {/* ── Cards grid ───────────────────────────────────────────────────── */}
      {listQuery.isLoading ? (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">
            {tab === 'PENDING' ? '⏳' : tab === 'APPROVED' ? '✅' : tab === 'HIDDEN' ? '🙈' : '📋'}
          </div>
          <p className="font-semibold text-secondary">No {tab.toLowerCase()} reviews</p>
          <p className="text-sm text-muted mt-1">
            {tab === 'PENDING'
              ? 'All caught up — no reviews waiting for moderation.'
              : search || rating
                ? 'Try adjusting your filters.'
                : `No ${tab.toLowerCase()} reviews yet.`}
          </p>
          {(search || rating) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setRating(''); }}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          {reviews.map((review) => (
            <ReviewModerationCard
              key={review.id}
              review={review}
              activeTab={tab}
              selected={selected.has(review.id)}
              onToggleSelect={toggleSelect}
              onApprove={handleApprove}
              onHide={handleHide}
              onDelete={handleDelete}
              onReply={setReplyTarget}
              loading={loadingId}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted">
            Page <span className="font-medium text-secondary">{page}</span> of{' '}
            <span className="font-medium text-secondary">{totalPages}</span>
            {' '}· {total} reviews
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-button hover:bg-muted/10 disabled:opacity-30 text-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const n = start + i;
              if (n > totalPages) return null;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={[
                    'w-8 h-8 text-xs font-medium rounded-button transition-colors',
                    n === page ? 'bg-primary text-white' : 'text-muted hover:bg-muted/10',
                  ].join(' ')}
                >
                  {n}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-button hover:bg-muted/10 disabled:opacity-30 text-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Reply modal ───────────────────────────────────────────────────── */}
      {replyTarget && (
        <ReviewReplyModal
          review={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSubmit={handleReplySubmit}
          onApprove={handleApprove}
          onHide={handleHide}
        />
      )}
    </>
  );
}
