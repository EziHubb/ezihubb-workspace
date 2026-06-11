'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ShoppingBag } from 'lucide-react';
import { Pagination, Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';

interface StoreOrderItem {
  productName: string;
  variantName: string | null;
  quantity:    number;
  unitPrice:   number;
}

interface StoreOrderRow {
  id:             string;
  status:         string;
  sellerEarnings: number;
  createdAt:      string;
  order: {
    orderNumber: string;
    shippingCity: string | null;
  };
  items: StoreOrderItem[];
}

interface PaginatedOrders {
  data: StoreOrderRow[];
  pagination: { page: number; totalPages: number; total: number };
}

const STATUS_TABS = [
  { label: 'All',        value: ''           },
  { label: 'New',        value: 'CONFIRMED'  },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped',    value: 'SHIPPED'    },
  { label: 'Delivered',  value: 'DELIVERED'  },
  { label: 'Cancelled',  value: 'CANCELLED'  },
];

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED:    'bg-purple-100 text-purple-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function OrderRowSkeleton() {
  return (
    <div className="p-4 border border-border rounded-card space-y-2 animate-pulse">
      <Skeleton variant="text" className="w-40" />
      <Skeleton variant="text" className="w-64" />
    </div>
  );
}

export default function SellerOrdersPage() {
  const locale = useLocale();
  const [status, setStatus] = useState('');
  const [page,   setPage  ] = useState(1);

  const { data, isLoading } = useAuthQuery<PaginatedOrders>(
    ['seller', 'orders', { status, page }],
    '/seller/orders',
    { status: status || undefined, page, limit: 20 },
  );

  const orders     = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total      = data?.pagination?.total      ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">Orders</h1>

      {/* Status tabs */}
      <div
        role="tablist"
        className="flex gap-1 border-b border-border overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={status === tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={[
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              status === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-secondary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <OrderRowSkeleton key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <ShoppingBag className="w-14 h-14 text-muted/30" />
          <p className="font-semibold text-secondary">No orders found</p>
          <p className="text-sm text-muted">
            {status ? 'Try a different status filter.' : 'Your first order will appear here.'}
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && orders.length > 0 && (
        <>
          <p className="text-sm text-muted">{total} order{total !== 1 ? 's' : ''}</p>
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/${locale}/seller/orders/${o.id}`}
                className="flex items-center gap-4 p-4 border border-border rounded-card hover:border-primary/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-secondary">
                      {o.order.orderNumber}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-muted/10 text-muted'}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">
                    {o.items.map((i) => `${i.productName}${i.variantName ? ` (${i.variantName})` : ''} ×${i.quantity}`).join(' · ')}
                  </p>
                  {o.order.shippingCity && (
                    <p className="text-xs text-muted mt-0.5">Ship to: {o.order.shippingCity}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-secondary text-sm tabular-nums">
                    ${o.sellerEarnings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted">{fmt.format(new Date(o.createdAt))}</p>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </>
      )}
    </div>
  );
}
