'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ShoppingBag, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { Pagination, Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderCounts {
  total:          number;
  confirmedCount: number;
  processingCount:number;
  shippedCount:   number;
  deliveredCount: number;
  cancelledCount: number;
}

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
    orderNumber:  string;
    shippingCity: string | null;
  };
  items: StoreOrderItem[];
}

interface PaginatedOrders {
  data:       StoreOrderRow[];
  pagination: { page: number; totalPages: number; total: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerOrdersPage() {
  const locale = useLocale();
  const [status, setStatus] = useState('');
  const [page,   setPage  ] = useState(1);

  const { data: counts } = useAuthQuery<OrderCounts>(
    ['seller', 'orders', 'counts'],
    API_ROUTES.SELLER.ORDERS_COUNTS,
  );

  const { data, isLoading } = useAuthQuery<PaginatedOrders>(
    ['seller', 'orders', { status, page }],
    API_ROUTES.SELLER.ORDERS,
    { status: status || undefined, page, limit: 20 },
  );

  const orders     = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total      = data?.pagination?.total      ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">Orders</h1>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ShoppingBag,  label: 'Total Orders', value: String(counts?.total           ?? 0), sub: 'all time',         color: 'bg-blue-500'   },
          { icon: Clock,        label: 'Processing',   value: String(counts?.processingCount  ?? 0), sub: 'needs fulfillment', color: 'bg-amber-500'  },
          { icon: Truck,        label: 'Shipped',      value: String(counts?.shippedCount     ?? 0), sub: 'in transit',        color: 'bg-purple-500' },
          { icon: CheckCircle2, label: 'Delivered',    value: String(counts?.deliveredCount   ?? 0), sub: 'completed',         color: 'bg-green-500'  },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-lg font-bold text-secondary tabular-nums">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────── */}
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
            {tab.value === 'PROCESSING' && (counts?.processingCount ?? 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                {counts?.processingCount ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-16 rounded-card" />
          ))}
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────────── */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          {status === 'CANCELLED'
            ? <XCircle className="w-14 h-14 text-muted/30" />
            : <ShoppingBag className="w-14 h-14 text-muted/30" />
          }
          <p className="font-semibold text-secondary">No orders found</p>
          <p className="text-sm text-muted">
            {status ? 'Try a different status filter.' : 'Your first order will appear here.'}
          </p>
        </div>
      )}

      {/* ── Order list ────────────────────────────────────────────────────── */}
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
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-muted/10 text-muted'}`}>
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
