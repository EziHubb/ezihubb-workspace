'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Package, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { fmtAmount, fmtDateTime } from '../../../../lib/fmt';
import { Pagination } from '@ezihubb/ui';

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

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700'  },
  APPROVED:  { label: 'Upcoming',       cls: 'bg-blue-100 text-blue-700'    },
  ACTIVE:    { label: 'Active',         cls: 'bg-primary/10 text-primary'   },
  ENDED:     { label: 'Ended',          cls: 'bg-muted/10 text-muted'       },
  CANCELLED: { label: 'Rejected',       cls: 'bg-error/10 text-error'       },
};

const PAGE_SIZE = 20;

export default function MyDealsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ data: MyFlashDeal[]; total: number }>({
    queryKey: ['seller-flash-deals', page],
    queryFn:  () =>
      api.get<{ data: MyFlashDeal[]; total: number }>('/admin/flash-deals', {
        params: { limit: String(PAGE_SIZE), page: String(page) },
      }),
    staleTime: 30_000,
  });

  const deals      = data?.data  ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <AdminPageHeader
        title="My Flash Deals"
        subtitle={`${total} deal${total !== 1 ? 's' : ''} submitted`}
        queryKey={['seller-flash-deals']}
        actions={
          <Link
            href="/flash-deals/submit"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit New Deal
          </Link>
        }
      />

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-12 h-12 rounded-input bg-border/30 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-border/30 rounded w-48" />
                  <div className="h-3 bg-border/20 rounded w-32" />
                </div>
                <div className="h-6 w-20 bg-border/20 rounded-full" />
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary/40" />
            </div>
            <p className="font-semibold text-secondary">No deals submitted yet</p>
            <p className="text-sm text-muted max-w-xs">
              Submit a flash deal to offer time-limited discounts and boost your sales.
            </p>
            <Link
              href="/flash-deals/submit"
              className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors"
            >
              <Plus className="w-4 h-4" />
              Submit Your First Deal
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {deals.map((deal) => {
              const cfg = STATUS_CFG[deal.status] ?? { label: deal.status, cls: 'bg-muted/10 text-muted' };
              return (
                <div key={deal.id} className="flex items-center gap-4 px-5 py-4">
                  {deal.productImage ? (
                    <img
                      src={deal.productImage}
                      alt={deal.productName}
                      className="w-12 h-12 rounded-input object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted/40" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-secondary line-clamp-1">{deal.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-sm font-bold text-primary tabular-nums">{fmtAmount(deal.dealPrice)}</span>
                      <span className="text-xs text-muted line-through tabular-nums">{fmtAmount(deal.originalPrice)}</span>
                      <span className="text-xs font-bold text-primary">-{deal.discountPct}%</span>
                      {deal.soldCount > 0 && (
                        <span className="text-xs text-muted">· {deal.soldCount} sold</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted">
                      <Clock className="w-3 h-3 shrink-0" />
                      {fmtDateTime(deal.startsAt)} → {fmtDateTime(deal.endsAt)}
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
