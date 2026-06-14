'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import {
  Zap, Plus, Clock, Package, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';

type DealStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

interface SellerFlashDeal {
  id:            string;
  productId:     string;
  productName:   string;
  productImage:  string | null;
  originalPrice: number;
  dealPrice:     number;
  discountPct:   number;
  startsAt:      string;
  endsAt:        string;
  soldCount:     number;
  quantityLimit: number | null;
  status:        DealStatus;
}

const TABS: { key: DealStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'PENDING',   label: 'Pending'   },
  { key: 'ACTIVE',    label: 'Active'    },
  { key: 'APPROVED',  label: 'Approved'  },
  { key: 'ENDED',     label: 'Ended'     },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_CFG: Record<DealStatus, { label: string; cls: string; dot?: boolean }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'         },
  APPROVED:  { label: 'Approved',  cls: 'bg-blue-100 text-blue-700'           },
  ACTIVE:    { label: 'Active',    cls: 'bg-primary/10 text-primary', dot: true },
  ENDED:     { label: 'Ended',     cls: 'bg-muted/10 text-muted'              },
  CANCELLED: { label: 'Cancelled', cls: 'bg-error/10 text-error'              },
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function fmtPrice(n: number) { return fmt.format(n); }
function fmtDate(s: string)  { return dateFmt.format(new Date(s)); }

function StatusBadge({ status }: { status: DealStatus }) {
  const { label, cls, dot } = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  );
}

export default function SellerFlashDealsPage() {
  const token     = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<DealStatus | 'ALL'>('ALL');

  const { data: deals, isLoading, isError } = useQuery<SellerFlashDeal[]>({
    queryKey: ['seller', 'flash-deals'],
    queryFn:  () => apiClient.get<SellerFlashDeal[]>('/flash-deals/my', { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 30_000,
  });

  const visible = (deals ?? []).filter((d) => tab === 'ALL' || d.status === tab);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Flash Deals
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Run time-limited discounts to boost visibility and drive quick sales.
          </p>
        </div>
        <Link
          href="./flash-deals/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Flash Deal
        </Link>
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const count = key === 'ALL'
            ? (deals ?? []).length
            : (deals ?? []).filter((d) => d.status === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-secondary',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-primary/10 text-primary' : 'bg-border text-muted'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 gap-3 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading your flash deals…</span>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-error/50" />
          <p className="text-sm font-semibold text-secondary">Something went wrong</p>
          <p className="text-xs text-muted">We couldn&apos;t load your flash deals. Please try refreshing.</p>
        </div>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center border border-dashed border-border rounded-card">
          <Zap className="w-12 h-12 text-muted/30" />
          <div>
            <p className="text-sm font-semibold text-secondary">No flash deals yet</p>
            <p className="text-xs text-muted mt-1">
              {tab === 'ALL'
                ? 'Create your first flash deal to attract buyers with limited-time offers.'
                : `No deals with "${STATUS_CFG[tab as DealStatus]?.label ?? tab}" status.`}
            </p>
          </div>
          {tab === 'ALL' && (
            <Link
              href="./flash-deals/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Flash Deal
            </Link>
          )}
        </div>
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <div className="border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Original</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Deal Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Dates</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Sold / Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((deal) => (
                  <tr key={deal.id} className="hover:bg-background/60 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {deal.productImage ? (
                          <img
                            src={deal.productImage}
                            alt={deal.productName}
                            className="w-10 h-10 rounded-input object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-input bg-border/30 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-muted/40" />
                          </div>
                        )}
                        <span className="font-medium text-secondary line-clamp-1 max-w-[180px]">
                          {deal.productName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted tabular-nums">
                      {fmtPrice(deal.originalPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-secondary tabular-nums">
                      {fmtPrice(deal.dealPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold tabular-nums">
                        -{deal.discountPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{fmtDate(deal.startsAt)}</span>
                        </div>
                        <div className="text-xs text-muted pl-4.5">
                          → {fmtDate(deal.endsAt)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm">
                      <span className="font-semibold text-secondary">{deal.soldCount}</span>
                      <span className="text-muted"> / {deal.quantityLimit ?? '∞'}</span>
                      {deal.quantityLimit !== null && (
                        <div className="w-16 h-1.5 bg-border rounded-full mt-1.5 overflow-hidden ml-auto">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, (deal.soldCount / deal.quantityLimit) * 100)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={deal.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-muted hover:text-primary transition-all"
                      >
                        Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
