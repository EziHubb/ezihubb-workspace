'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Zap, Clock, Check, X, Package, Loader2, AlertCircle, ChevronDown,
  Star, SlidersHorizontal,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtDate, fmtDateTime, fmtNum } from '../../../lib/fmt';

type DealStatus = 'PENDING' | 'ACTIVE' | 'UPCOMING' | 'ENDED';

interface FlashDealRow {
  id:            string;
  storeId:       string;
  storeName:     string;
  productId:     string;
  productName:   string;
  productImage:  string | null;
  originalPrice: number;
  dealPrice:     number;
  discountPct:   number;
  startsAt:      string;
  endsAt:        string;
  quantityLimit: number | null;
  soldCount:     number;
  submittedAt:   string;
  status:        DealStatus;
}

interface FlashDealStats {
  activeNow:     number;
  pendingReview: number;
  endingToday:   number;
  totalThisWeek: number;
}

interface ReviewPayload {
  approved:          boolean;
  commissionOverride: number | null;
  featured:          boolean;
  adminNote:         string;
  rejectionReason?:  string;
}

const PAGE_SIZE = 20;

const REJECT_REASONS = [
  'Product price appears artificially inflated prior to deal',
  'Discount does not meet the 20% minimum threshold',
  'Product images are low quality or missing',
  'Duplicate deal submitted within the exclusion window',
  'Product violates marketplace guidelines',
  'Other — see admin note',
];

const STATUS_CFG: Record<DealStatus, { label: string; cls: string; dot?: boolean }> = {
  PENDING:  { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700'        },
  ACTIVE:   { label: 'Active',         cls: 'bg-primary/10 text-primary', dot: true },
  UPCOMING: { label: 'Upcoming',       cls: 'bg-blue-100 text-blue-700'           },
  ENDED:    { label: 'Ended',          cls: 'bg-muted/10 text-muted'              },
};

const TABS: { key: DealStatus; label: string }[] = [
  { key: 'PENDING',  label: 'Pending Review' },
  { key: 'ACTIVE',   label: 'Active'         },
  { key: 'UPCOMING', label: 'Upcoming'       },
  { key: 'ENDED',    label: 'Ended'          },
];

function StatusBadge({ status }: { status: DealStatus }) {
  const { label, cls, dot } = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  );
}

function MiniStat({
  label, value, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'amber' | 'green';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    amber: { bg: 'bg-amber-50',   text: 'text-amber-600' },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-secondary tabular-nums leading-tight">
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function AdminFlashDealsPage() {
  const qc = useQueryClient();

  const [tab,         setTab]         = useState<DealStatus>('PENDING');
  const [page,        setPage]        = useState(1);
  const [reviewing,   setReviewing]   = useState<FlashDealRow | null>(null);
  const [commission,  setCommission]  = useState<string>('');
  const [featured,    setFeatured]    = useState(false);
  const [adminNote,   setAdminNote]   = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const statsQuery = useQuery<FlashDealStats>({
    queryKey: ['admin-flash-deals-stats'],
    queryFn:  () => api.get<FlashDealStats>(API_ROUTES.ADMIN.FLASH_DEALS_STATS),
    staleTime: 60_000,
  });
  const stats = statsQuery.data;

  const listKey = ['admin-flash-deals', tab, page];
  const listQuery = useQuery<{ data: FlashDealRow[]; total: number }>({
    queryKey: listKey,
    queryFn:  () =>
      api.get<{ data: FlashDealRow[]; total: number }>(API_ROUTES.ADMIN.FLASH_DEALS, {
        params: { status: tab, page: String(page), limit: String(PAGE_SIZE) },
      }),
  });

  const deals = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-flash-deals'] });
    qc.invalidateQueries({ queryKey: ['admin-flash-deals-stats'] });
  };

  const openReview = (deal: FlashDealRow) => {
    setReviewing(deal);
    setCommission('');
    setFeatured(false);
    setAdminNote('');
    setRejectModal(false);
    setRejectReason('');
  };

  const reviewMutation = useMutation<void, Error, ReviewPayload & { id: string }>({
    mutationFn: ({ id, ...payload }) =>
      api.patch(API_ROUTES.ADMIN.FLASH_DEAL(id), payload),
    onSuccess: () => {
      invalidate();
      setReviewing(null);
    },
  });

  const handleApprove = () => {
    if (!reviewing) return;
    reviewMutation.mutate({
      id:                 reviewing.id,
      approved:           true,
      commissionOverride: commission ? parseFloat(commission) : null,
      featured,
      adminNote,
    });
  };

  const handleReject = () => {
    if (!reviewing || !rejectReason) return;
    reviewMutation.mutate({
      id:                 reviewing.id,
      approved:           false,
      commissionOverride: null,
      featured:           false,
      adminNote,
      rejectionReason:    rejectReason,
    });
    setRejectModal(false);
  };

  const columns = useMemo<ColumnDef<FlashDealRow>[]>(() => {
    if (tab === 'PENDING') {
      return [
        {
          id:     'product',
          header: 'Product',
          size:   220,
          cell:   ({ row }: { row: { original: FlashDealRow } }) => {
            const d = row.original;
            return (
              <div className="flex items-center gap-3">
                {d.productImage ? (
                  <img src={d.productImage} alt={d.productName} className="w-10 h-10 rounded-input object-cover border border-border shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted/40" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary line-clamp-1">{d.productName}</p>
                  <p className="text-xs text-muted">{d.storeName}</p>
                </div>
              </div>
            );
          },
        },
        {
          id:     'original',
          header: 'Original',
          size:   90,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="text-sm text-muted tabular-nums">{fmtAmount(row.original.originalPrice)}</span>,
        },
        {
          id:     'dealPrice',
          header: 'Deal Price',
          size:   90,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="text-sm font-semibold text-secondary tabular-nums">{fmtAmount(row.original.dealPrice)}</span>,
        },
        {
          id:     'discount',
          header: 'Discount',
          size:   80,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">-{row.original.discountPct}%</span>,
        },
        {
          id:     'startsAt',
          header: 'Start Time',
          size:   130,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="text-xs text-muted">{fmtDateTime(row.original.startsAt)}</span>,
        },
        {
          id:     'qty',
          header: 'Qty Limit',
          size:   80,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="text-sm text-muted tabular-nums">{row.original.quantityLimit ?? '∞'}</span>,
        },
        {
          id:     'submitted',
          header: 'Submitted',
          size:   110,
          cell:   ({ row }: { row: { original: FlashDealRow } }) =>
            <span className="text-xs text-muted">{fmtDate(row.original.submittedAt)}</span>,
        },
        {
          id:   'actions',
          size: 110,
          header: '',
          cell: ({ row }: { row: { original: FlashDealRow } }) => (
            <button
              type="button"
              onClick={() => openReview(row.original)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Review
            </button>
          ),
        },
      ];
    }

    return [
      {
        id:     'product',
        header: 'Product',
        size:   220,
        cell:   ({ row }: { row: { original: FlashDealRow } }) => {
          const d = row.original;
          return (
            <div className="flex items-center gap-3">
              {d.productImage ? (
                <img src={d.productImage} alt={d.productName} className="w-10 h-10 rounded-input object-cover border border-border shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-muted/40" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary line-clamp-1">{d.productName}</p>
                <p className="text-xs text-muted">{d.storeName}</p>
              </div>
            </div>
          );
        },
      },
      {
        id:     'dealPrice',
        header: 'Deal Price',
        size:   100,
        cell:   ({ row }: { row: { original: FlashDealRow } }) => (
          <div>
            <span className="text-sm font-semibold text-secondary tabular-nums">{fmtAmount(row.original.dealPrice)}</span>
            <span className="ml-1.5 text-xs text-muted line-through tabular-nums">{fmtAmount(row.original.originalPrice)}</span>
          </div>
        ),
      },
      {
        id:     'discount',
        header: 'Discount',
        size:   80,
        cell:   ({ row }: { row: { original: FlashDealRow } }) =>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">-{row.original.discountPct}%</span>,
      },
      {
        id:     'dates',
        header: 'Window',
        size:   190,
        cell:   ({ row }: { row: { original: FlashDealRow } }) => (
          <div className="space-y-0.5 text-xs text-muted">
            <div className="flex items-center gap-1"><Clock className="w-3 h-3 shrink-0" /> {fmtDateTime(row.original.startsAt)}</div>
            <div className="pl-4">→ {fmtDateTime(row.original.endsAt)}</div>
          </div>
        ),
      },
      {
        id:     'sold',
        header: 'Sold / Limit',
        size:   110,
        cell:   ({ row }: { row: { original: FlashDealRow } }) => {
          const d = row.original;
          const pct = d.quantityLimit ? (d.soldCount / d.quantityLimit) * 100 : 0;
          return (
            <div>
              <span className="text-sm font-semibold text-secondary tabular-nums">{d.soldCount}</span>
              <span className="text-muted text-xs"> / {d.quantityLimit ?? '∞'}</span>
              {d.quantityLimit !== null && (
                <div className="w-full h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              )}
            </div>
          );
        },
      },
      {
        id:     'status',
        header: 'Status',
        size:   120,
        cell:   ({ row }: { row: { original: FlashDealRow } }) => <StatusBadge status={row.original.status} />,
      },
    ];
  }, [tab]);

  return (
    <>
      <AdminPageHeader
        title="Flash Deals"
        subtitle={`${total} deal${total !== 1 ? 's' : ''} · ${tab.toLowerCase()} view`}
        queryKey={['admin-flash-deals']}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Active Now"       value={stats?.activeNow ?? '—'}     icon={Zap}          color="coral"  />
        <MiniStat label="Pending Review"   value={stats?.pendingReview ?? '—'} icon={Clock}        color="amber"  />
        <MiniStat label="Ending Today"     value={stats?.endingToday ?? '—'}   icon={AlertCircle}  color="blue"   />
        <MiniStat label="Total This Week"  value={stats?.totalThisWeek ?? '—'} icon={Package}      color="green"  />
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-5 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setPage(1); setReviewing(null); }}
            className={[
              'shrink-0 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted hover:text-secondary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={reviewing ? 'pr-[26rem]' : ''}>
        <DataTable
          data={deals}
          columns={columns}
          isLoading={listQuery.isLoading}
          pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
          emptyTitle="No flash deals found"
          emptyDesc="Flash deals in this status will appear here."
        />
      </div>

      {reviewing && (
        <div className="fixed right-0 top-0 h-full w-96 bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="font-semibold text-secondary flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Review Deal
            </h3>
            <button type="button" onClick={() => setReviewing(null)} className="text-muted hover:text-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1">
            <div className="rounded-card border border-border overflow-hidden">
              {reviewing.productImage ? (
                <img src={reviewing.productImage} alt={reviewing.productName} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-border/10 flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted/20" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <p className="font-semibold text-secondary text-sm">{reviewing.productName}</p>
                <p className="text-xs text-muted">by {reviewing.storeName}</p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-lg font-bold text-secondary tabular-nums">{fmtAmount(reviewing.dealPrice)}</span>
                  <span className="text-sm text-muted line-through tabular-nums">{fmtAmount(reviewing.originalPrice)}</span>
                  <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
                    -{reviewing.discountPct}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted pt-0.5">
                  <Clock className="w-3 h-3 shrink-0" />
                  {fmtDateTime(reviewing.startsAt)} → {fmtDateTime(reviewing.endsAt)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Validation Checklist</p>
              {[
                'Discount is between 20% and 60%',
                'Product has valid images',
                'Start time is at least 1 hour from now',
                'No duplicate deal within 7-day window',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-secondary">
                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-green-600" />
                  </div>
                  {item}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">
                Commission Override <span className="text-muted font-normal normal-case">(optional, %)</span>
              </label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="Leave blank to use store default"
                className="w-full px-3 py-2 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary">Feature this deal</p>
                <p className="text-xs text-muted">Show on homepage flash deal carousel</p>
              </div>
              <button
                type="button"
                onClick={() => setFeatured(!featured)}
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  featured ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${featured ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {featured && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-card text-xs text-primary">
                <Star className="w-3.5 h-3.5 shrink-0" />
                This deal will be highlighted in the featured flash deals section.
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">Admin Note</label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal note for audit purposes…"
                className="w-full px-3 py-2 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setRejectModal(true)}
              disabled={reviewMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-2 border-error text-error hover:bg-error/5 rounded-button transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={reviewMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-button transition-colors disabled:opacity-50"
            >
              {reviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve
            </button>
          </div>
        </div>
      )}

      {rejectModal && reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-secondary">Reject Flash Deal</h3>
              <button type="button" onClick={() => setRejectModal(false)} className="text-muted hover:text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted">
              Select the reason for rejecting <span className="font-semibold text-secondary">{reviewing.productName}</span> from{' '}
              <span className="font-semibold text-secondary">{reviewing.storeName}</span>.
            </p>

            <div className="space-y-2">
              {REJECT_REASONS.map((reason) => (
                <label key={reason} className="flex items-start gap-3 cursor-pointer group">
                  <div
                    className={[
                      'mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      rejectReason === reason ? 'border-error bg-error' : 'border-border group-hover:border-error/60',
                    ].join(' ')}
                    onClick={() => setRejectReason(reason)}
                  >
                    {rejectReason === reason && <span className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-secondary select-none">{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-border/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectReason || reviewMutation.isPending}
                className="flex-1 py-2.5 text-sm font-semibold bg-error hover:bg-error/90 text-white rounded-button transition-colors disabled:opacity-50"
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
