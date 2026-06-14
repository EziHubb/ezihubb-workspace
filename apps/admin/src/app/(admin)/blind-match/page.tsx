'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Package, Heart, Camera, Check, X, Loader2, Gift, Sparkles, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { fmtAmount } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlindMatchStats {
  totalGifts:       number;
  avgMatchRating:   number;
  refundRate:       number;
  curationRevenue:  number;
}

interface BlindMatchRow {
  id:              string;
  niche:           string;
  budgetRange:     string;
  aiProductName:   string | null;
  aiProductId:     string | null;
  rating:          number | null;
  status:          string;
  createdAt:       string;
}

interface BlindMatchListResponse {
  data:       BlindMatchRow[];
  total:      number;
  page:       number;
  totalPages: number;
}

interface RefundRow {
  requestId: string;
  niche:     string;
  budget:    string;
  feedback:  string | null;
  refunded:  boolean;
}

interface TopAiProduct {
  productId:   string;
  productName: string;
  timesSelected: number;
  avgRating:   number;
}

interface UgcSubmission {
  id:          string;
  niche:       string;
  gifterName:  string | null;
  caption:     string | null;
  rating:      number | null;
  imageUrl:    string | null;
  createdAt:   string;
}

interface UgcPendingResponse {
  count: number;
  items: UgcSubmission[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function formatNiche(raw: string) {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING:  'bg-amber-100 text-amber-700',
    MATCHED:  'bg-blue-100 text-blue-700',
    REVEALED: 'bg-purple-100 text-purple-700',
    RATED:    'bg-green-100 text-green-700',
    REFUNDED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? 'bg-muted/10 text-muted'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted text-sm">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-border'}`}
        />
      ))}
      <span className="text-xs text-muted ml-1 tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon:  React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted font-medium leading-tight mb-1">{label}</p>
        <p className="text-2xl font-bold text-secondary tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBlindMatchPage() {
  const qc      = useQueryClient();
  const [page,  setPage]  = useState(1);

  const statsQ = useQuery<BlindMatchStats>({
    queryKey: ['admin', 'blind-match', 'stats'],
    queryFn:  () => api.get<BlindMatchStats>('/admin/blind-match/stats'),
  });

  const listQ = useQuery<BlindMatchListResponse>({
    queryKey: ['admin', 'blind-match', 'list', page],
    queryFn:  () => api.get<BlindMatchListResponse>(`/admin/blind-match?page=${page}&limit=20`),
  });

  const refundsQ = useQuery<RefundRow[]>({
    queryKey: ['admin', 'blind-match', 'refunds'],
    queryFn:  () => api.get<RefundRow[]>('/admin/blind-match/refunds'),
  });

  const topProductsQ = useQuery<TopAiProduct[]>({
    queryKey: ['admin', 'blind-match', 'top-products'],
    queryFn:  () => api.get<TopAiProduct[]>('/admin/blind-match/top-products'),
  });

  const ugcQ = useQuery<UgcPendingResponse>({
    queryKey: ['admin', 'blind-match', 'ugc', 'pending'],
    queryFn:  () => api.get<UgcPendingResponse>('/admin/blind-match/ugc/pending'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/blind-match/ugc/${id}/approve`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'blind-match', 'ugc'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/blind-match/ugc/${id}/reject`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'blind-match', 'ugc'] }),
  });

  const stats    = statsQ.data;
  const rows     = listQ.data?.data ?? [];
  const refunds  = refundsQ.data ?? [];
  const topProds = topProductsQ.data ?? [];
  const ugcItems = ugcQ.data?.items ?? [];
  const ugcCount = ugcQ.data?.count ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Blind Match"
        subtitle="AI curation quality, match ratings, and UGC moderation"
        queryKey={['admin', 'blind-match', 'stats']}
      />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon={Gift}
          label="Total blind gifts"
          value={statsQ.isLoading ? '…' : String(stats?.totalGifts ?? 0)}
          color="bg-primary"
        />
        <StatCard
          icon={Star}
          label="Avg match rating"
          value={statsQ.isLoading ? '…' : (stats?.avgMatchRating ?? 0).toFixed(2) + ' ★'}
          color="bg-amber-500"
        />
        <StatCard
          icon={RefreshCw}
          label="Refund rate"
          value={statsQ.isLoading ? '…' : fmtPct(stats?.refundRate ?? 0)}
          color="bg-red-500"
        />
        <StatCard
          icon={Sparkles}
          label="Curation revenue"
          value={statsQ.isLoading ? '…' : fmtAmount(stats?.curationRevenue ?? 0)}
          color="bg-green-500"
        />
      </div>

      {/* ── Match quality table ───────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-secondary">Recent matches</h2>
          {listQ.isLoading && <Loader2 className="w-4 h-4 text-muted animate-spin" />}
        </div>
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['ID', 'Niche', 'Budget', 'AI selected product', 'Rating', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && !listQ.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No matches yet.</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{row.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs text-secondary font-medium">{formatNiche(row.niche)}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{row.budgetRange}</td>
                    <td className="px-4 py-3 text-xs text-secondary max-w-[160px] truncate">
                      {row.aiProductName ?? <span className="text-muted italic">Not matched yet</span>}
                    </td>
                    <td className="px-4 py-3"><RatingStars value={row.rating} /></td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => window.open(`/admin/orders?search=${row.id}`, '_blank')}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(listQ.data?.totalPages ?? 0) > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted">
                Page {listQ.data?.page ?? 1} of {listQ.data?.totalPages ?? 1}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs px-3 py-1.5 border border-border rounded-lg text-secondary disabled:opacity-40 hover:bg-background transition-colors"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= (listQ.data?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1.5 border border-border rounded-lg text-secondary disabled:opacity-40 hover:bg-background transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Two-column: Refund tracker + Top AI products ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Refund tracker */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-secondary">Refund tracker</h2>
            <span className="text-xs text-muted">(1–2 star ratings)</span>
            {refundsQ.isLoading && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />}
          </div>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Request ID', 'Niche', 'Budget', 'Feedback', 'Refunded'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refunds.length === 0 && !refundsQ.isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">No refunds on record.</td>
                  </tr>
                )}
                {refunds.map((r) => (
                  <tr key={r.requestId} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.requestId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs text-secondary">{formatNiche(r.niche)}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{r.budget}</td>
                    <td className="px-4 py-3 text-xs text-secondary max-w-[120px] truncate">{r.feedback ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.refunded
                        ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> Yes</span>
                        : <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><X className="w-3.5 h-3.5" /> No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top AI-selected products */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-secondary">Top AI-selected products</h2>
            {topProductsQ.isLoading && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />}
          </div>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Product', 'Times selected', 'Avg rating'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProds.length === 0 && !topProductsQ.isLoading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">No data yet.</td>
                  </tr>
                )}
                {topProds.map((p, i) => (
                  <tr key={p.productId} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted w-5 tabular-nums">#{i + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span className="text-xs font-medium text-secondary truncate max-w-[140px]">
                            {p.productName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-secondary tabular-nums">{p.timesSelected}</td>
                    <td className="px-4 py-3"><RatingStars value={p.avgRating} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── UGC moderation ────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-secondary">UGC moderation</h2>
          {ugcCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
              {ugcCount > 99 ? '99+' : ugcCount}
            </span>
          )}
          <span className="text-xs text-muted">pending review</span>
          {ugcQ.isLoading && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />}
        </div>

        {ugcItems.length === 0 && !ugcQ.isLoading && (
          <div className="bg-surface border border-border rounded-card px-5 py-10 text-center">
            <Camera className="w-7 h-7 text-muted/40 mx-auto mb-2" />
            <p className="text-sm text-muted">No UGC submissions pending review.</p>
          </div>
        )}

        {ugcItems.length > 0 && (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Preview', 'Niche', 'Gifter', 'Caption', 'Rating', 'Submitted', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ugcItems.map((item) => (
                  <tr key={item.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt="UGC preview"
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted/10 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-muted/40" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">{formatNiche(item.niche)}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{item.gifterName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[180px] truncate">{item.caption ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RatingStars value={item.rating} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(item.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectMutation.mutate(item.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
