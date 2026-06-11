'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { api } from '@mlh/api-client';

interface ProductItem {
  id:        string;
  name:      string;
  basePrice: number;
  isActive:  boolean;
  status:    string;
  soldCount: number;
  images?:   { url: string; isPrimary: boolean }[];
}

interface ProductsResponse {
  data:       ProductItem[];
  pagination: { page: number; total: number; totalPages: number };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  DRAFT:    'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

export default function SellerProductsPage() {
  const locale = useLocale();
  const qc     = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['seller', 'products', page],
    queryFn:  () => api.get<ProductsResponse>(`/seller/products?page=${page}&limit=20`),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/seller/products/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/seller/products/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  });

  const products   = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Products</h1>
          <p className="text-sm text-muted mt-0.5">{pagination?.total ?? 0} listings</p>
        </div>
        <Link
          href={`/${locale}/account/creator`}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-4 py-2.5 rounded-button transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Product
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/10 rounded-card animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-12 text-center">
          <Package className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="font-medium text-secondary">No products yet</p>
          <p className="text-sm text-muted mt-1 mb-4">Add your first product to start selling.</p>
          <Link
            href={`/${locale}/account/creator`}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-4 py-2 rounded-button hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-card overflow-hidden bg-background">
          {products.map((p) => {
            const thumb = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
            return (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-10 h-10 rounded-md bg-muted/20 overflow-hidden shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{p.name || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-muted/10 text-muted'}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-muted">{p.soldCount} sold</span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-secondary tabular-nums shrink-0">
                  ${Number(p.basePrice).toFixed(2)}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={p.isActive ? 'Deactivate' : 'Activate'}
                    onClick={() => toggleMutation.mutate({ id: p.id, isActive: !p.isActive })}
                    className="p-1.5 text-muted hover:text-secondary transition-colors"
                  >
                    {p.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/${locale}/account/creator/products/${p.id}`}
                    className="p-1.5 text-muted hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm('Delete this product? This cannot be undone.')) {
                        deleteMutation.mutate(p.id);
                      }
                    }}
                    className="p-1.5 text-muted hover:text-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm px-3 py-1.5 border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {pagination.totalPages}</span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm px-3 py-1.5 border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <div className="border border-border rounded-card p-4">
        <p className="text-xs text-muted">
          Full product editing (variants, images, shipping) is available in the{' '}
          <Link href={`/${locale}/account/creator`} className="text-primary hover:underline font-medium">
            Creator Hub
          </Link>.
        </p>
      </div>
    </div>
  );
}
