'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Plus, Clock, Package, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { fmtAmount, fmtDateTime } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyFlashDeal {
  id:            string;
  productName:   string;
  productImage:  string | null;
  originalPrice: number;
  dealPrice:     number;
  discountPct:   number;
  startsAt:      string;
  endsAt:        string;
  quantityLimit: number | null;
  soldCount:     number;
  status:        string;
}

interface CreateFlashDealDto {
  storeId:       string;
  productId:     string;
  originalPrice: number;
  dealPrice:     number;
  discountPct:   number;
  quantityLimit?: number;
  startsAt:      string;
  endsAt:        string;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700' },
  APPROVED:  { label: 'Upcoming',       cls: 'bg-blue-100 text-blue-700'   },
  ACTIVE:    { label: 'Active',         cls: 'bg-primary/10 text-primary'  },
  ENDED:     { label: 'Ended',          cls: 'bg-muted/10 text-muted'      },
  CANCELLED: { label: 'Rejected',       cls: 'bg-error/10 text-error'      },
};

const inputCls = 'w-full border border-border rounded-input px-3 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerFlashDealsPage() {
  const { data: session } = useSession();
  const user     = session?.user as Record<string, unknown> | undefined;
  const storeId  = (user?.['storeId'] as string) ?? '';
  const router   = useRouter();
  const qc       = useQueryClient();

  const [showForm,      setShowForm]      = useState(false);
  const [productId,     setProductId]     = useState('');
  const [manualStoreId, setManualStoreId] = useState(storeId);
  const [origPrice,     setOrigPrice]     = useState('');
  const [dealPrice,     setDealPrice]     = useState('');
  const [qtyLimit,      setQtyLimit]      = useState('');
  const [startsAt,      setStartsAt]      = useState('');
  const [endsAt,        setEndsAt]        = useState('');
  const [success,       setSuccess]       = useState(false);

  const discountPct = origPrice && dealPrice
    ? Math.round(((parseFloat(origPrice) - parseFloat(dealPrice)) / parseFloat(origPrice)) * 100)
    : 0;

  const myDealsQuery = useQuery<{ data: MyFlashDeal[]; total: number }>({
    queryKey: ['seller-flash-deals'],
    queryFn:  () => api.get<{ data: MyFlashDeal[]; total: number }>('/admin/flash-deals', {
      params: { limit: '50' },
    }),
  });
  const myDeals = myDealsQuery.data?.data ?? [];

  const createMutation = useMutation<unknown, Error, CreateFlashDealDto>({
    mutationFn: (dto) => api.post('/admin/flash-deals', dto),
    onSuccess: () => {
      setSuccess(true);
      setShowForm(false);
      setProductId(''); setOrigPrice(''); setDealPrice('');
      setQtyLimit(''); setStartsAt(''); setEndsAt('');
      qc.invalidateQueries({ queryKey: ['seller-flash-deals'] });
      setTimeout(() => setSuccess(false), 5000);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sid = manualStoreId.trim() || storeId;
    if (!sid) return;
    createMutation.mutate({
      storeId:       sid,
      productId:     productId.trim(),
      originalPrice: parseFloat(origPrice),
      dealPrice:     parseFloat(dealPrice),
      discountPct,
      startsAt:      new Date(startsAt).toISOString(),
      endsAt:        new Date(endsAt).toISOString(),
      ...(qtyLimit && { quantityLimit: parseInt(qtyLimit, 10) }),
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Flash Deals"
        subtitle="Submit limited-time deals for admin approval"
        queryKey={['seller-flash-deals']}
      />

      {/* Success banner */}
      {success && (
        <div className="mb-4 flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-card text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Deal submitted for admin review. You&apos;ll be notified once it&apos;s approved.</span>
          <button type="button" onClick={() => setSuccess(false)} className="ml-auto text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-card text-sm text-secondary">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-primary">How Flash Deals work</p>
          <p className="text-muted text-xs">Submit a deal with a minimum 20% discount. Our team reviews within 24 hours. Once approved, your deal goes live at the scheduled time and appears on the Flash Deals page.</p>
        </div>
      </div>

      {/* Submit button */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-secondary">My Submitted Deals</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors"
        >
          <Plus className="w-4 h-4" />
          Submit New Deal
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 bg-surface border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-secondary flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> New Flash Deal Submission
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!storeId && (
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-muted">Store ID</label>
                  <input
                    value={manualStoreId}
                    onChange={(e) => setManualStoreId(e.target.value)}
                    placeholder="Your store ID"
                    required
                    className={inputCls}
                  />
                </div>
              )}

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-muted">Product ID</label>
                <input
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="Product UUID from your store"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">Original Price ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={origPrice}
                  onChange={(e) => setOrigPrice(e.target.value)}
                  placeholder="e.g. 80.00"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">
                  Deal Price ($)
                  {discountPct > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${discountPct >= 20 ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      -{discountPct}%
                      {discountPct < 20 && ' (min 20%)'}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value)}
                  placeholder="e.g. 50.00"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">Quantity Limit (optional)</label>
                <input
                  type="number"
                  min="1"
                  value={qtyLimit}
                  onChange={(e) => setQtyLimit(e.target.value)}
                  placeholder="Leave blank for unlimited"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
            </div>

            {createMutation.isError && (
              <div className="flex items-start gap-2 p-2.5 bg-error/8 border border-error/20 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error">Failed to submit. Please check all fields and try again.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-border/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || discountPct < 20}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Submit for Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing deals */}
      {myDealsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : myDeals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Zap className="w-12 h-12 text-muted/20" />
          <p className="font-semibold text-secondary">No flash deals yet</p>
          <p className="text-sm text-muted">Submit your first flash deal to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {myDeals.map((deal) => {
            const cfg = STATUS_CFG[deal.status] ?? { label: deal.status, cls: 'bg-muted/10 text-muted' };
            return (
              <div
                key={deal.id}
                className="flex items-center gap-4 bg-surface border border-border rounded-card p-4"
              >
                {deal.productImage ? (
                  <img src={deal.productImage} alt={deal.productName} className="w-12 h-12 rounded-input object-cover border border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted/40" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-secondary line-clamp-1">{deal.productName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm font-bold text-primary tabular-nums">{fmtAmount(deal.dealPrice)}</span>
                    <span className="text-xs text-muted line-through tabular-nums">{fmtAmount(deal.originalPrice)}</span>
                    <span className="text-xs font-bold text-primary">-{deal.discountPct}%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted">
                    <Clock className="w-3 h-3 shrink-0" />
                    {fmtDateTime(deal.startsAt)} → {fmtDateTime(deal.endsAt)}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted">Sold</p>
                    <p className="text-sm font-semibold text-secondary tabular-nums">
                      {deal.soldCount}{deal.quantityLimit ? ` / ${deal.quantityLimit}` : ''}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
