'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Package, ExternalLink, ShoppingBag } from 'lucide-react';
import { useOrders } from '@mlh/api-client';
import { OrderStatusBadge, Pagination, Skeleton } from '@mlh/ui';
import type { OrderDto, OrderStatus } from '@mlh/types';

// ── Filter tabs ───────────────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All',           value: ''             },
  { label: 'Pending',       value: 'CONFIRMED'    },
  { label: 'In Production', value: 'IN_PRODUCTION' },
  { label: 'Shipped',       value: 'SHIPPED'       },
  { label: 'Delivered',     value: 'DELIVERED'     },
  { label: 'Cancelled',     value: 'CANCELLED'     },
];

// ── Date formatter ────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day:   'numeric',
  year:  'numeric',
});

// ── Skeleton ──────────────────────────────────────────────────────────────────

function OrderCardSkeleton() {
  return (
    <div className="border border-border rounded-card p-4 space-y-4 animate-pulse">
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="w-16 h-16 rounded-sm" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" className="w-48" />
        <Skeleton variant="text" className="w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton variant="rect" className="h-9 w-28 rounded-button" />
        <Skeleton variant="rect" className="h-9 w-28 rounded-button" />
      </div>
    </div>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({ order, locale }: { order: OrderDto; locale: string }) {
  const thumbnails = order.items.slice(0, 3);
  const extra      = order.items.length - 3;

  return (
    <article className="border border-border rounded-card p-4 hover:border-primary/40 transition-colors space-y-4">
      {/* Item thumbnails */}
      <div className="flex items-center gap-2">
        {thumbnails.map((item) => {
          const src =
            (item.customization as Record<string, unknown> | null)?.['previewUrl'] as
              | string
              | undefined ?? item.product?.imageUrl;
          return (
            <div
              key={item.id}
              className="relative w-16 h-16 rounded-sm overflow-hidden bg-background border border-border shrink-0"
            >
              {src ? (
                <Image src={src} alt={item.product?.name ?? ''} fill sizes="64px" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted" />
                </div>
              )}
            </div>
          );
        })}
        {extra > 0 && (
          <div className="w-16 h-16 rounded-sm bg-muted/10 border border-border flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-muted">+{extra}</span>
          </div>
        )}
      </div>

      {/* Order meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-secondary">
            {order.orderNumber}
          </p>
          <p className="text-xs text-muted">{fmt.format(new Date(order.createdAt))}</p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge
            status={order.status as Parameters<typeof OrderStatusBadge>[0]['status']}
          />
          <span className="font-bold text-secondary text-sm tabular-nums">
            ${order.total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <Link
          href={`/${locale}/account/orders/${order.orderNumber}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-4 py-2 hover:border-primary hover:text-primary transition-colors"
        >
          View Details
        </Link>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-button px-4 py-2 hover:bg-primary/5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Track Order
          </a>
        )}
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const locale = useLocale();
  const [activeStatus, setActiveStatus] = useState('');
  const [page,         setPage]         = useState(1);

  const { data, isLoading } = useOrders({
    page,
    limit:  10,
    status: activeStatus || undefined,
  });

  const orders     = data?.data       ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total      = data?.pagination?.total      ?? 0;

  const handleTabChange = (value: string) => {
    setActiveStatus(value);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">My Orders</h1>

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Filter orders by status"
        className="flex gap-1 border-b border-border overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeStatus === tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={[
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              activeStatus === tab.value
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
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <ShoppingBag className="w-14 h-14 text-muted/30" aria-hidden />
          <div>
            <p className="font-semibold text-secondary text-base">No orders yet</p>
            <p className="text-sm text-muted mt-1">
              {activeStatus
                ? 'No orders with this status.'
                : "You haven't placed any orders."}
            </p>
          </div>
          <Link
            href={`/${locale}/products`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            Shop Now
          </Link>
        </div>
      )}

      {/* Order list */}
      {!isLoading && orders.length > 0 && (
        <>
          <p className="text-sm text-muted">
            <span className="font-semibold text-secondary">{total}</span> order
            {total !== 1 ? 's' : ''}
          </p>
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} locale={locale} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
