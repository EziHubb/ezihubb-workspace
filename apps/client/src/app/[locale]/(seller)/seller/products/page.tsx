'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';

interface SellerProduct {
  id:        string;
  name:      string;
  slug:      string;
  basePrice: number;
  status:    string;
  stock:     number | null;
  imageUrl:  string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  DRAFT:    'bg-border/30 text-muted',
  ARCHIVED: 'bg-orange-100 text-orange-700',
};

export default function SellerProductsPage() {
  const t           = useTranslations('seller');
  const locale      = useLocale();
  const token       = useAuthStore((s) => s.accessToken);
  const qc          = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ data: SellerProduct[]; total: number; totalPages: number }>({
    queryKey: ['seller-products', page],
    queryFn:  () => apiClient.get(`${API_ROUTES.SELLER.PRODUCTS}?page=${page}&limit=20`, { token: token ?? undefined }),
    enabled:  !!token,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(API_ROUTES.SELLER.PRODUCT_STATUS(id), { status }, { token: token ?? undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-products'] }),
  });

  const products   = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-secondary">{t('products.title')}</h1>
        <Link
          href={`/${locale}/seller/products/new`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('products.addProduct')}
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="p-14 text-center">
            <Package className="w-10 h-10 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">{t('products.noProducts')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/40">
              <tr>
                {[t('products.table.product'), t('products.table.price'), t('products.table.status'), t('products.table.stock'), t('products.table.actions')].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-border/20 flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted/40" />
                        </div>
                      )}
                      <span className="font-medium text-secondary truncate max-w-[200px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold">{fmtAmount(p.basePrice)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] ?? 'bg-border/30 text-muted'}`}>
                      {t.has(`status.${p.status}`) ? t(`status.${p.status}`) : p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{p.stock ?? '∞'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/${locale}/seller/products/${p.id}/edit`} className="text-xs text-primary hover:underline">{t('products.edit')}</Link>
                      <button
                        type="button"
                        onClick={() => toggleStatus.mutate({ id: p.id, status: p.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE' })}
                        className="text-xs text-muted hover:text-secondary"
                      >
                        {p.status === 'ACTIVE' ? t('products.unpublish') : t('products.publish')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
