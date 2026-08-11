'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';

interface SellerOrder {
  id:          string;
  orderNumber: string;
  status:      string;
  total:       number;
  itemCount:   number;
  createdAt:   string;
  shippingName: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED:    'bg-indigo-100 text-indigo-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const STATUSES = ['', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function SellerOrdersPage() {
  const t                     = useTranslations('seller');
  const locale                = useLocale();
  const token                 = useAuthStore((s) => s.accessToken);
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useQuery<{ data: SellerOrder[]; total: number; totalPages: number }>({
    queryKey: ['seller-orders', status, page],
    queryFn:  () => apiClient.get(
      `${API_ROUTES.SELLER.ORDERS}?status=${status}&page=${page}&limit=20`,
      { token: token ?? undefined },
    ),
    enabled: !!token,
  });

  const orders    = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-secondary">{t('orders.title')}</h1>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-button text-xs font-semibold border transition-colors ${
              status === s ? 'bg-primary text-white border-primary' : 'border-border text-secondary hover:bg-background'
            }`}
          >
            {s ? (t.has(`status.${s}`) ? t(`status.${s}`) : s) : t('orders.all')}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4].map((i) => <div key={i} className="h-10 bg-border/20 rounded animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-14 text-center">
            <ShoppingBag className="w-10 h-10 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">{t('orders.noOrders')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/40">
              <tr>
                {[t('orders.table.order'), t('orders.table.customer'), t('orders.table.items'), t('orders.table.total'), t('orders.table.status'), t('orders.table.date')].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-secondary">{o.orderNumber}</td>
                  <td className="px-5 py-3 text-muted">{o.shippingName}</td>
                  <td className="px-5 py-3 text-muted">{o.itemCount}</td>
                  <td className="px-5 py-3 font-semibold">{fmtAmount(o.total)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'bg-border/30 text-muted'}`}>
                      {t.has(`status.${o.status}`) ? t(`status.${o.status}`) : o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(o.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border border-border rounded-button disabled:opacity-40 hover:bg-background">{t('pagination.prev')}</button>
          <span className="px-3 py-1.5 text-sm text-muted">{t('pagination.page', { current: page, total: totalPages })}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border border-border rounded-button disabled:opacity-40 hover:bg-background">{t('pagination.next')}</button>
        </div>
      )}
    </div>
  );
}
