'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDateTime, fmtRelative, capitalize, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendDraft {
  id:          string;
  keyword:     string;
  category:    string | null;
  score:       number;
  source:      string;
  status:      'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  summary:     string | null;
  suggestedAt: string;
  reviewedAt:  string | null;
  reviewedBy:  string | null;
}

interface TrendDraftsResponse {
  data:       TrendDraft[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TrendDraft['status'], string> = {
  PENDING_REVIEW: 'Pending',
  APPROVED:       'Approved',
  REJECTED:       'Rejected',
  EXPIRED:        'Expired',
};

function StatusBadge({ status }: { status: TrendDraft['status'] }) {
  const cfg = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-700',
    APPROVED:       'bg-green-100 text-green-700',
    REJECTED:       'bg-red-100 text-red-700',
    EXPIRED:        'bg-gray-100 text-gray-500',
  }[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct   = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

// ── Row detail panel ──────────────────────────────────────────────────────────

function DraftRow({
  draft,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  draft:     TrendDraft;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPending = draft.status === 'PENDING_REVIEW';

  return (
    <>
      <tr className="hover:bg-background transition-colors cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="px-4 py-3">
          <span className="text-muted">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-secondary text-sm">{draft.keyword}</td>
        <td className="px-4 py-3 text-sm text-muted">{draft.category ?? '—'}</td>
        <td className="px-4 py-3 w-32"><ScoreBar score={draft.score} /></td>
        <td className="px-4 py-3 text-xs text-muted">{capitalize(draft.source.toLowerCase())}</td>
        <td className="px-4 py-3"><StatusBadge status={draft.status} /></td>
        <td className="px-4 py-3 text-xs text-muted">{fmtRelative(draft.suggestedAt)}</td>
        <td className="px-4 py-3">
          {isPending && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onApprove(draft.id)}
                disabled={approving || rejecting}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-button hover:bg-green-100 disabled:opacity-40 transition-colors"
              >
                {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => onReject(draft.id)}
                disabled={approving || rejecting}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-button hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                {rejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Reject
              </button>
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-background">
          <td colSpan={8} className="px-6 py-3 text-sm text-muted border-b border-border">
            {draft.summary
              ? <p className="leading-relaxed">{draft.summary}</p>
              : <em>No AI summary available.</em>}
            {draft.reviewedAt && (
              <p className="mt-1.5 text-xs text-muted/60">
                Reviewed {fmtDateTime(draft.reviewedAt)}{draft.reviewedBy ? ` by ${draft.reviewedBy}` : ''}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK = (status: string, page: number) => ['ai-trend-drafts', status, page];

export default function AiTrendsPage() {
  const [status, setStatus] = useState<'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_REVIEW');
  const [page,   setPage]   = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TrendDraftsResponse>({
    queryKey: QK(status, page),
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'ALL') p.set('status', status);
      return api.get<TrendDraftsResponse>(`${API_ROUTES.ADMIN.AI_TREND_DRAFTS}?${p}`);
    },
    staleTime: 30_000,
  });

  const [actionId, setActionId] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_TREND_DRAFT_APPROVE(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] }); qc.invalidateQueries({ queryKey: ['sidebar-ai-trend-pending'] }); },
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_TREND_DRAFT_REJECT(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] }); qc.invalidateQueries({ queryKey: ['sidebar-ai-trend-pending'] }); },
  });

  const scan = useMutation({
    mutationFn: () => api.post(API_ROUTES.ADMIN.AI_TREND_SCAN, {}),
    onSettled:  () => qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] }),
  });

  const drafts     = safeArr(data?.data);
  const pagination = data?.pagination;

  return (
    <div>
      <AdminPageHeader
        title="Trend Dashboard"
        subtitle="Review AI-suggested product trends and approve them for merchandising"
        queryKey={QK(status, page)}
        actions={
          <button
            type="button"
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {scan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Trigger Scan
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            className={[
              'px-3 py-1.5 text-sm rounded-button border transition-colors',
              status === s
                ? 'bg-primary text-white border-primary'
                : 'border-border text-muted hover:border-primary hover:text-secondary',
            ].join(' ')}
          >
            {s === 'PENDING_REVIEW' ? 'Pending' : capitalize(s.toLowerCase())}
          </button>
        ))}
        {pagination && (
          <span className="ml-auto text-xs text-muted">{pagination.total} total</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted">No trend drafts for this filter.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="w-8" />
                  {['Keyword', 'Category', 'Score', 'Source', 'Status', 'Suggested', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drafts.map((d) => (
                  <DraftRow
                    key={d.id}
                    draft={d}
                    onApprove={(id) => approve.mutate(id)}
                    onReject={(id) => reject.mutate(id)}
                    approving={approve.isPending && actionId === d.id}
                    rejecting={reject.isPending && actionId === d.id}
                  />
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Previous
                  </button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
