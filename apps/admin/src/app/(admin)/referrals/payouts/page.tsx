'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReferralPayoutRow {
  id:            string;
  amount:        number;
  status:        string;
  paymentMethod: string;
  paymentDetail: string;
  adminNotes:    string | null;
  createdAt:     string;
  processedAt:   string | null;
  user: {
    firstName: string | null;
    lastName:  string | null;
    email:     string;
  };
}

interface PayoutsResponse {
  data:       ReferralPayoutRow[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  REQUESTED:  'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-muted/10 text-muted'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Mark paid modal ────────────────────────────────────────────────────────────

function MarkPaidModal({
  payout,
  onClose,
  onDone,
}: {
  payout:  ReferralPayoutRow;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handlePay = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(API_ROUTES.ADMIN.ADMIN_CREATORS_PAYOUT_PAY(payout.id), { adminNotes: notes || undefined });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">Mark as Paid</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-background rounded-card border border-border p-4 space-y-1.5">
          <p className="text-sm font-semibold text-secondary">
            {[payout.user.firstName, payout.user.lastName].filter(Boolean).join(' ') || payout.user.email}
          </p>
          <p className="text-xs text-muted">{payout.user.email}</p>
          <div className="flex items-center gap-3 pt-1">
            <p className="text-lg font-bold text-secondary tabular-nums">${Number(payout.amount).toFixed(2)}</p>
            <span className="text-xs text-muted capitalize">{payout.paymentMethod.replace(/_/g, ' ')}</span>
            <code className="text-xs font-mono bg-muted/10 px-2 py-0.5 rounded text-muted">{payout.paymentDetail}</code>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Admin Notes <span className="font-normal text-muted/70">(optional — include tx ID or reference)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="PayPal tx #XXXXXXXXXXXX"
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handlePay}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-button disabled:opacity-50 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            {saving ? 'Saving…' : 'Mark as Paid'}
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

function RejectPayoutModal({
  payout,
  onClose,
  onDone,
}: {
  payout:  ReferralPayoutRow;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [reason,  setReason]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleReject = async () => {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(API_ROUTES.ADMIN.ADMIN_CREATORS_PAYOUT_REJECT(payout.id), { reason });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">Reject Payout</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted">
          Rejecting <strong className="text-secondary">${Number(payout.amount).toFixed(2)}</strong> payout request.
          The balance will be restored to the user&apos;s account.
        </p>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Invalid payment details provided. Please update your payout information."
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
            {saving ? 'Rejecting…' : 'Reject Payout'}
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

const STATUS_TABS = ['REQUESTED', 'PROCESSING', 'PAID', 'REJECTED'] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function ReferralPayoutsPage() {
  const qc = useQueryClient();
  const [tab,       setTab]       = useState<StatusTab>('REQUESTED');
  const [page,      setPage]      = useState(1);
  const [payingOut, setPayingOut] = useState<ReferralPayoutRow | null>(null);
  const [rejecting, setRejecting] = useState<ReferralPayoutRow | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20', status: tab });

  const { data, isLoading } = useQuery<PayoutsResponse>({
    queryKey: ['admin-referral-payouts', tab, page],
    queryFn:  () => api.get<PayoutsResponse>(`${API_ROUTES.ADMIN.ADMIN_CREATORS_PAYOUTS}?${params.toString()}`),
    staleTime: 30_000,
  });

  const handleModalDone = () => {
    setPayingOut(null);
    setRejecting(null);
    void qc.invalidateQueries({ queryKey: ['admin-referral-payouts'] });
  };

  return (
    <>
      <AdminPageHeader
        title="Referral Payouts"
        subtitle="Review and process referral programme payout requests"
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
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary hover:border-border',
              ].join(' ')}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {['User', 'Amount', 'Method / Detail', 'Requested', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : (data?.data ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-secondary">
                          {[p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-secondary tabular-nums">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-secondary capitalize">{p.paymentMethod.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted mt-0.5 font-mono truncate max-w-[200px]">{p.paymentDetail}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {format(new Date(p.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={p.status} />
                          {p.adminNotes && (
                            <p className="text-[11px] text-muted font-mono truncate max-w-[160px]" title={p.adminNotes}>
                              {p.adminNotes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(p.status === 'REQUESTED' || p.status === 'PROCESSING') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPayingOut(p)}
                              className="px-2.5 py-1 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-button transition-colors"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejecting(p)}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-button transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {p.status === 'PAID' && p.processedAt && (
                          <p className="text-xs text-muted">Paid {format(new Date(p.processedAt), 'MMM d')}</p>
                        )}
                      </td>
                    </tr>
                  ))
              }
              {!isLoading && (data?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    No payout requests with status {tab.toLowerCase()}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">Page {data.page} of {data.totalPages} · {data.total} total</p>
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

      {payingOut && <MarkPaidModal payout={payingOut} onClose={() => setPayingOut(null)} onDone={handleModalDone} />}
      {rejecting && <RejectPayoutModal payout={rejecting} onClose={() => setRejecting(null)} onDone={handleModalDone} />}
    </>
  );
}
