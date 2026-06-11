'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, Pencil, Trash2, Eye, EyeOff, Search, AlertTriangle } from 'lucide-react';
import { api } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

interface ProductItem {
  id:              string;
  name:            string;
  basePrice:       number;
  isActive:        boolean;
  status:          string;
  soldCount:       number;
  moderationStatus?: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED' | null;
  moderationNote?:  string | null;
  images?:         { url: string; isPrimary: boolean }[];
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

const MOD_COLORS: Record<string, string> = {
  PENDING:  'bg-blue-50 text-blue-600 border-blue-200',
  FLAGGED:  'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const MOD_ICONS: Record<string, React.ElementType> = {
  PENDING:  AlertTriangle,
  FLAGGED:  AlertTriangle,
  REJECTED: AlertTriangle,
};

export default function SellerProductsPage() {
  const locale = useLocale();
  const qc     = useQueryClient();
  const [page,   setPage  ] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modFilter, setModFilter] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['seller', 'products', page, debouncedSearch, modFilter],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (modFilter)       p.set('moderationStatus', modFilter);
      return api.get<ProductsResponse>(`${API_ROUTES.SELLER.PRODUCTS}?${p}`);
    },
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(API_ROUTES.SELLER.PRODUCT_STATUS(id), { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(API_ROUTES.SELLER.PRODUCT(id)),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  });

  const products   = data?.data ?? [];
  const pagination = data?.pagination;

  const flaggedCount = products.filter((p) => p.moderationStatus === 'FLAGGED' || p.moderationStatus === 'REJECTED').length;

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

      {/* ── AI moderation alert ────────────────────────────────────────────── */}
      {flaggedCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">
              {flaggedCount} product{flaggedCount > 1 ? 's' : ''} flagged for review
            </p>
            <p className="text-xs mt-0.5 text-amber-700">
              Our content policy system has flagged these listings. Please review and update them to stay compliant.
            </p>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-button focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={modFilter}
          onChange={(e) => { setModFilter(e.target.value); setPage(1); }}
          className="text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary transition-colors"
        >
          <option value="">All statuses</option>
          <option value="FLAGGED">⚠ Flagged</option>
          <option value="REJECTED">✕ Rejected</option>
          <option value="PENDING">… Under review</option>
          <option value="APPROVED">✓ Approved</option>
        </select>
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
          <p className="font-medium text-secondary">
            {search || modFilter ? 'No products match your search' : 'No products yet'}
          </p>
          <p className="text-sm text-muted mt-1 mb-4">
            {search || modFilter ? 'Try a different search or filter.' : 'Add your first product to start selling.'}
          </p>
          {!search && !modFilter && (
            <Link
              href={`/${locale}/account/creator`}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-4 py-2 rounded-button hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-card overflow-hidden bg-background">
          {products.map((p) => {
            const thumb  = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
            const modKey = p.moderationStatus as keyof typeof MOD_COLORS | undefined;
            const ModIcon = modKey && MOD_ICONS[modKey] ? MOD_ICONS[modKey] : null;

            return (
              <div key={p.id}
                className={`flex items-center gap-4 px-4 py-3 ${modKey === 'FLAGGED' || modKey === 'REJECTED' ? 'bg-amber-50/40' : ''}`}>
                <div className="w-10 h-10 rounded-md bg-muted/20 overflow-hidden shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{p.name || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-muted/10 text-muted'}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-muted">{p.soldCount} sold</span>
                    {modKey && MOD_COLORS[modKey] && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${MOD_COLORS[modKey]}`}>
                        {ModIcon && <ModIcon className="w-2.5 h-2.5" />}
                        {modKey === 'PENDING' ? 'Under review' : modKey}
                      </span>
                    )}
                  </div>
                  {p.moderationNote && (modKey === 'FLAGGED' || modKey === 'REJECTED') && (
                    <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{p.moderationNote}</p>
                  )}
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
