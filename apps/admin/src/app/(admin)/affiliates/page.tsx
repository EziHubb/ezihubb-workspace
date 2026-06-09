'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, X, Check, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { clientFetch } from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AffiliateRow {
  id:             string;
  email:          string;
  firstName:      string | null;
  lastName:       string | null;
  referralCode:   string;
  status:         string;
  commissionRate: number | null;
  balance:        number;
  createdAt:      string;
}

interface AffiliatesResponse {
  data:       AffiliateRow[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-green-100 text-green-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  REJECTED:  'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-muted/10 text-muted'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Approve modal ──────────────────────────────────────────────────────────────

function ApproveModal({
  affiliate,
  onClose,
  onDone,
}: {
  affiliate: AffiliateRow;
  onClose:   () => void;
  onDone:    () => void;
}) {
  const [rate,    setRate]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleApprove = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (rate !== '') body['commissionRate'] = Number(rate) / 100;
      const res = await clientFetch(`/admin/affiliates/${affiliate.id}/approve`, {
        method: 'POST',
        body:   JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error((j as { error?: { message?: string } })?.error?.message ?? 'Approval failed');
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">Approve Application</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted">
          Approving <strong className="text-secondary">{affiliate.firstName} {affiliate.lastName}</strong> ({affiliate.email}).
          They&apos;ll receive their referral code <code className="font-mono bg-muted/10 px-1 rounded text-xs">{affiliate.referralCode}</code>.
        </p>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Commission Rate % <span className="font-normal text-muted/70">(leave blank for global default)</span>
          </label>
          <div className="relative w-40">
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 10"
              min={0}
              max={100}
              step={0.1}
              className="w-full px-3 py-2 pr-7 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-button disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({
  affiliate,
  onClose,
  onDone,
}: {
  affiliate: AffiliateRow;
  onClose:   () => void;
  onDone:    () => void;
}) {
  const [reason,  setReason]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleReject = async () => {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await clientFetch(`/admin/affiliates/${affiliate.id}/reject`, {
        method: 'POST',
        body:   JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error((j as { error?: { message?: string } })?.error?.message ?? 'Rejection failed');
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">Reject Application</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted">
          Rejecting <strong className="text-secondary">{affiliate.firstName} {affiliate.lastName}</strong> ({affiliate.email}).
          The reason will be sent to them by email.
        </p>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Thank you for applying. Unfortunately we can't proceed at this time because…"
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleReject}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-button disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            {saving ? 'Rejecting…' : 'Reject'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const STATUS_TABS = ['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function AffiliatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab,     setTab]     = useState<StatusTab>('ALL');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [approving, setApproving] = useState<AffiliateRow | null>(null);
  const [rejecting, setRejecting] = useState<AffiliateRow | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (tab !== 'ALL') params.set('status', tab);
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery<AffiliatesResponse>({
    queryKey: ['admin-affiliates', tab, search, page],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/affiliates?${params.toString()}`);
      const body = await res.json();
      return (body.data ?? body) as AffiliatesResponse;
    },
    staleTime: 30_000,
  });

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ['admin-affiliates-pending-count'],
    queryFn:  async () => {
      const res  = await clientFetch('/admin/affiliates/pending-count');
      const body = await res.json();
      return (body.data ?? body) as { count: number };
    },
    staleTime: 30_000,
  });

  const handleModalDone = () => {
    setApproving(null);
    setRejecting(null);
    void qc.invalidateQueries({ queryKey: ['admin-affiliates'] });
    void qc.invalidateQueries({ queryKey: ['admin-affiliates-pending-count'] });
  };

  return (
    <>
      <AdminPageHeader
        title="Affiliates"
        subtitle="Manage affiliate applications, approvals, and accounts"
      />

      {/* Tab strip */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setPage(1); }}
              className={[
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary hover:border-border',
              ].join(' ')}
            >
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
              {t === 'PENDING' && (pendingCount?.count ?? 0) > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingCount!.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, code…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {data && (
          <span className="text-sm text-muted ml-auto">{data.total.toLocaleString()} affiliate{data.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {['Name / Email', 'Referral Code', 'Commission', 'Balance', 'Status', 'Applied', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : (data?.data ?? []).map((a) => (
                    <tr key={a.id} className="hover:bg-muted/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-secondary">
                          {[a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-muted mt-0.5 font-mono">{a.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs bg-muted/10 px-2 py-0.5 rounded">{a.referralCode}</code>
                      </td>
                      <td className="px-4 py-3 text-secondary tabular-nums">
                        {a.commissionRate !== null ? `${(a.commissionRate * 100).toFixed(1)}%` : <span className="text-muted text-xs">Global</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-secondary tabular-nums">
                        ${a.balance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {format(new Date(a.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/affiliates/${a.id}`)}
                            className="p-1.5 rounded-button border border-border text-muted hover:text-primary hover:border-primary/40 transition-colors"
                            title="View detail"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          {a.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setApproving(a)}
                                className="px-2.5 py-1 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-button transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejecting(a)}
                                className="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-button transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              Page {data.page} of {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {approving && <ApproveModal affiliate={approving} onClose={() => setApproving(null)} onDone={handleModalDone} />}
      {rejecting && <RejectModal affiliate={rejecting} onClose={() => setRejecting(null)} onDone={handleModalDone} />}
    </>
  );
}
