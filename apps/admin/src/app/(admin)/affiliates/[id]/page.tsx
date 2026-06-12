'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Save } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDate, fmtNum, fmtAmount, capitalize } from '../../../../lib/fmt';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommissionRow {
  id:          string;
  orderId:     string;
  orderNumber: string;
  baseAmount:  number;
  rate:        number;
  amount:      number;
  status:      string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt:   string;
}

interface ClickRow {
  id:          string;
  landingPage: string;
  convertedAt: string | null;
  createdAt:   string;
}

interface AffiliateDetail {
  id:               string;
  email:            string;
  firstName:        string | null;
  lastName:         string | null;
  website:          string | null;
  promoDescription: string | null;
  referralCode:     string;
  commissionRate:   number | null;
  status:           string;
  balance:          number;
  totalEarned:      number;
  adminNotes:       string | null;
  rejectedReason:   string | null;
  approvedAt:       string | null;
  createdAt:        string;
  stats: {
    totalClicks:       number;
    totalConversions:  number;
    conversionRate:    number;
  };
  commissions:  CommissionRow[];
  recentClicks: ClickRow[];
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
      {capitalize(status)}
    </span>
  );
}

const COMMISSION_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-muted/10 text-muted',
};

// ── Approve / Reject section ───────────────────────────────────────────────────

function PendingActions({
  affiliate,
  onDone,
}: {
  affiliate: AffiliateDetail;
  onDone:    () => void;
}) {
  const [approveRate, setApproveRate] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [mode,    setMode]    = useState<'idle' | 'approve' | 'reject'>('idle');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleApprove = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (approveRate !== '') body['commissionRate'] = Number(approveRate) / 100;
      await api.post(API_ROUTES.ADMIN.AFFILIATE_APPROVE(affiliate.id), body);
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { setError('Reason required.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(API_ROUTES.ADMIN.AFFILIATE_REJECT(affiliate.id), { reason: rejectReason });
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-card p-5">
      <p className="text-sm font-semibold text-amber-800 mb-3">Application pending review</p>

      {mode === 'idle' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('approve')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-button transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
          <button
            type="button"
            onClick={() => setMode('reject')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-button transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}

      {mode === 'approve' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Commission rate % <span className="font-normal">(blank = global default)</span>
            </label>
            <div className="relative w-36">
              <input
                type="number"
                value={approveRate}
                onChange={(e) => setApproveRate(e.target.value)}
                placeholder="e.g. 10"
                min={0} max={100} step={0.1}
                className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleApprove} disabled={saving}
              className="px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-button disabled:opacity-50 transition-colors">
              {saving ? 'Approving…' : 'Confirm Approve'}
            </button>
            <button type="button" onClick={() => setMode('idle')} className="px-3 py-1.5 text-xs text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'reject' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Rejection reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleReject} disabled={saving}
              className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-button disabled:opacity-50 transition-colors">
              {saving ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button type="button" onClick={() => setMode('idle')} className="px-3 py-1.5 text-xs text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit panel ─────────────────────────────────────────────────────────────────

function EditPanel({
  affiliate,
  onSaved,
}: {
  affiliate: AffiliateDetail;
  onSaved:   () => void;
}) {
  const [status,         setStatus]         = useState(affiliate.status);
  const [commissionRate, setCommissionRate] = useState(
    affiliate.commissionRate !== null ? String((affiliate.commissionRate * 100).toFixed(1)) : '',
  );
  const [adminNotes, setAdminNotes] = useState(affiliate.adminNotes ?? '');
  const [saving,     setSaving]     = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = { status, adminNotes: adminNotes || null };
      if (commissionRate !== '') body['commissionRate'] = Number(commissionRate) / 100;
      else body['commissionRate'] = null;

      await api.patch(API_ROUTES.ADMIN.AFFILIATE(affiliate.id), body);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-surface border border-border rounded-card p-5 space-y-4">
      <h4 className="font-semibold text-secondary text-sm">Account Settings</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Commission Rate % <span className="font-normal">(blank = global default)</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="Global default"
              min={0} max={100} step={0.1}
              className="w-full px-3 py-2 pr-7 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Admin Notes (internal)</label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes visible only to admins…"
          className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-button transition-colors disabled:opacity-50 ${done ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : done ? '✓ Saved' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AffiliateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: affiliate, isLoading } = useQuery<AffiliateDetail>({
    queryKey: ['admin-affiliate', id],
    queryFn:  () => api.get<AffiliateDetail>(API_ROUTES.ADMIN.AFFILIATE(id)),
    staleTime: 30_000,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-affiliate', id] });

  if (isLoading) {
    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-24 bg-muted/10 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface border border-border rounded-card animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  if (!affiliate) {
    return (
      <div className="text-center py-20">
        <p className="text-secondary font-medium">Affiliate not found.</p>
        <button type="button" onClick={() => router.back()} className="mt-3 text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const fullName = [affiliate.firstName, affiliate.lastName].filter(Boolean).join(' ') || affiliate.email;

  return (
    <>
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Affiliates
      </button>

      <AdminPageHeader
        title={fullName}
        subtitle={affiliate.email}
      />

      <div className="grid grid-cols-3 gap-6 mt-2">

        {/* ── Left column (2/3) ─────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-6">

          {/* Pending banner */}
          {affiliate.status === 'PENDING' && (
            <PendingActions affiliate={affiliate} onDone={invalidate} />
          )}

          {/* Application info */}
          <div className="bg-surface border border-border rounded-card p-5">
            <h4 className="font-semibold text-secondary text-sm mb-4">Application</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                { label: 'First name',       value: affiliate.firstName ?? '—' },
                { label: 'Last name',        value: affiliate.lastName  ?? '—' },
                { label: 'Email',            value: affiliate.email },
                { label: 'Website',          value: affiliate.website ?? '—' },
                { label: 'Referral code',    value: affiliate.referralCode },
                { label: 'Applied',          value: fmtDate(affiliate.createdAt) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">{label}</dt>
                  <dd className="text-secondary">{value}</dd>
                </div>
              ))}
              {affiliate.promoDescription && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Promo description</dt>
                  <dd className="text-secondary">{affiliate.promoDescription}</dd>
                </div>
              )}
              {affiliate.rejectedReason && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Rejection reason</dt>
                  <dd className="text-red-600">{affiliate.rejectedReason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Commission history */}
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h4 className="font-semibold text-secondary text-sm">Commission History</h4>
            </div>
            {affiliate.commissions.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted text-center">No commissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      {['Order', 'Commission', 'Rate', 'Amount', 'Status', 'Date'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {affiliate.commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/3 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs text-primary">{c.orderNumber}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted tabular-nums">${fmtAmount(c.baseAmount)}</td>
                        <td className="px-4 py-2.5 text-muted tabular-nums">{(c.rate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 font-semibold text-secondary tabular-nums">${fmtAmount(c.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${COMMISSION_COLORS[c.status] ?? 'bg-muted/10 text-muted'}`}>
                            {capitalize(c.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                          {fmtDate(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent clicks */}
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h4 className="font-semibold text-secondary text-sm">Recent Clicks (last 20)</h4>
            </div>
            {affiliate.recentClicks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted text-center">No clicks tracked yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      {['Date', 'Landing Page', 'Converted?'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {affiliate.recentClicks.map((cl) => (
                      <tr key={cl.id} className="hover:bg-muted/3 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                          {fmtDate(cl.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-muted max-w-xs truncate" title={cl.landingPage}>
                          {cl.landingPage}
                        </td>
                        <td className="px-4 py-2.5">
                          {cl.convertedAt ? (
                            <span className="text-xs font-semibold text-green-700">✓ Yes</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column (1/3) ────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status + KPIs */}
          <div className="bg-surface border border-border rounded-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-secondary text-sm">Status</h4>
              <StatusBadge status={affiliate.status} />
            </div>

            {affiliate.approvedAt && (
              <p className="text-xs text-muted">
                Approved {fmtDate(affiliate.approvedAt)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              {[
                { label: 'Balance',     value: `$${fmtAmount(affiliate.balance)}` },
                { label: 'Total Earned', value: `$${fmtAmount(affiliate.totalEarned)}` },
                { label: 'Clicks',      value: fmtNum(affiliate.stats.totalClicks) },
                { label: 'Conversions', value: fmtNum(affiliate.stats.totalConversions) },
                { label: 'Conv. Rate',  value: `${(affiliate.stats.conversionRate * 100).toFixed(1)}%` },
                {
                  label: 'Commission',
                  value: affiliate.commissionRate !== null
                    ? `${(affiliate.commissionRate * 100).toFixed(1)}%`
                    : 'Global',
                },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-background rounded-card p-3">
                  <p className="text-xs text-muted mb-0.5">{label}</p>
                  <p className="font-bold text-secondary tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Edit panel */}
          <EditPanel affiliate={affiliate} onSaved={invalidate} />
        </div>
      </div>
    </>
  );
}
