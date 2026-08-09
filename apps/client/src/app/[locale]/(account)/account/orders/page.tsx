'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Package, ShoppingBag, ChevronRight, Truck, MapPin } from 'lucide-react';
import { queryKeys } from '@ezihubb/api-client';
import { OrderStatusBadge, Pagination, Skeleton } from '@ezihubb/ui';
import type { OrderListItemDto } from '@ezihubb/types';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { fmtAmount, safeArr, safeNum } from '@ezihubb/utils';

// ── Filter tabs ───────────────────────────────────────────────────────────────

const STATUS_TABS: { key: string; value: string }[] = [
  { key: 'all',          value: ''              },
  { key: 'pending',      value: 'CONFIRMED'     },
  { key: 'inProduction', value: 'IN_PRODUCTION' },
  { key: 'shipped',      value: 'SHIPPED'       },
  { key: 'delivered',    value: 'DELIVERED'     },
  { key: 'cancelled',    value: 'CANCELLED'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day:   'numeric',
  year:  'numeric',
});

const STATUS_ACCENT: Record<string, string> = {
  CONFIRMED:        'border-l-blue-400',
  IN_PRODUCTION:    'border-l-violet-400',
  SHIPPED:          'border-l-amber-400',
  DELIVERED:        'border-l-green-500',
  COMPLETED:        'border-l-green-500',
  CANCELLED:        'border-l-red-400',
  REFUNDED:         'border-l-red-300',
  REFUND_REQUESTED: 'border-l-orange-400',
  DISPUTED:         'border-l-red-500',
  PENDING_PAYMENT:  'border-l-gray-300',
};

// ── Pagination shape ──────────────────────────────────────────────────────────

interface OrdersPage {
  data:       OrderListItemDto[];
  pagination: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function OrderCardSkeleton() {
  return (
    <div className="border border-border rounded-card overflow-hidden animate-pulse">
      <div className="flex gap-4 p-4">
        <Skeleton variant="rect" className="w-20 h-20 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton variant="text" className="w-36" />
          <Skeleton variant="text" className="w-24" />
          <Skeleton variant="text" className="w-48" />
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Skeleton variant="rect" className="w-24 h-6 rounded-full" />
          <Skeleton variant="text" className="w-16" />
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 flex gap-2">
        <Skeleton variant="rect" className="h-8 w-28 rounded-button" />
        <Skeleton variant="rect" className="h-8 w-28 rounded-button" />
      </div>
    </div>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({ order, locale }: { order: OrderListItemDto; locale: string }) {
  const t      = useTranslations('account');
  const thumb  = order.previewUrl ?? order.imageUrl ?? null;
  const accent = STATUS_ACCENT[order.status] ?? 'border-l-border';
  const extra  = Math.max(0, safeNum(order.itemCount) - 1);

  return (
    <article
      className={`border border-border border-l-4 ${accent} rounded-card overflow-hidden hover:shadow-card-hover transition-shadow bg-surface`}
    >
      {/* ── Main row ── */}
      <div className="flex gap-4 p-4">

        {/* Thumbnail */}
        <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-background border border-border">
          {thumb ? (
            <Image
              src={thumb}
              alt={`Order ${order.orderNumber}`}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted/40" />
            </div>
          )}
          {extra > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-xs font-bold">+{extra}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-0.5 space-y-1.5">
          <p className="font-mono text-sm font-bold text-secondary tracking-tight">
            {order.orderNumber}
          </p>
          <p className="text-xs text-muted">
            {fmt.format(new Date(order.createdAt as string))}
            {' · '}
            <span className="font-medium text-secondary">
              {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
            </span>
          </p>
          {/* Status + total on same row for desktop */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <OrderStatusBadge
              status={order.status as Parameters<typeof OrderStatusBadge>[0]['status']}
            />
            <span className="text-sm font-bold text-secondary tabular-nums">
              {fmtAmount(order.total)}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <Link
          href={`/${locale}/account/orders/${order.orderNumber}`}
          className="self-center shrink-0 text-muted hover:text-primary transition-colors"
          aria-label="View order details"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* ── Action bar ── */}
      <div className="border-t border-border px-4 py-2.5 flex flex-wrap gap-2 bg-background/50">
        <Link
          href={`/${locale}/account/orders/${order.orderNumber}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"
        >
          {t('orders.actions.viewDetails')}
        </Link>
        {order.status === 'SHIPPED' && (
          <Link
            href={`/${locale}/account/orders/${order.orderNumber}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/40 rounded-button px-3 py-1.5 hover:bg-primary/5 transition-colors"
          >
            <Truck className="w-3.5 h-3.5" />
            Track Package
          </Link>
        )}
        {order.status === 'DELIVERED' && (
          <Link
            href={`/${locale}/products`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/40 rounded-button px-3 py-1.5 hover:bg-primary/5 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Write a Review
          </Link>
        )}
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const locale = useLocale();
  const t = useTranslations('account');
  const [activeStatus, setActiveStatus] = useState('');
  const [page,         setPage]         = useState(1);

  const { data: pagedData, isLoading } = useAuthQuery<OrdersPage>(
    queryKeys.orders({ status: activeStatus || undefined, page }),
    '/orders/me',
    { status: activeStatus || undefined, limit: 10, page },
  );

  const orders     = safeArr(pagedData?.data);
  const totalPages = pagedData?.pagination?.totalPages ?? 1;
  const total      = pagedData?.pagination?.total      ?? 0;

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
      <h1 className="font-display text-2xl font-bold text-secondary">{t('orders.title')}</h1>

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label={t('orders.filterLabel')}
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
            {t(`orders.tabs.${tab.key}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
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
            <p className="font-semibold text-secondary text-base">{t('orders.empty.noOrders')}</p>
            <p className="text-sm text-muted mt-1">
              {activeStatus
                ? t('orders.empty.noOrdersFiltered')
                : t('orders.empty.noOrdersPlaced')}
            </p>
          </div>
          <Link
            href={`/${locale}/search`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            {t('orders.empty.shopNow')}
          </Link>
        </div>
      )}

      {/* Order list */}
      {!isLoading && orders.length > 0 && (
        <>
          <p className="text-sm text-muted">
            {t('orders.count', { total })}
          </p>
          <div className="space-y-3">
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
