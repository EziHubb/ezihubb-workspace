'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, X, Eye, EyeOff, Package, Upload, LayoutGrid, List, ChevronLeft, ChevronRight, Tag, Download, Archive } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { ProductCard, type AdminProduct } from '../../../components/products/ProductCard';
import { api, adminApi } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtDate, capitalize, fmtNum } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductStats {
  all:      number;
  active:   number;
  draft:    number;
  inactive: number;
  archived: number;
}

const PAGE_SIZE      = 20;
const VIEW_LS_KEY    = 'mlh_admin_products_view';

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc',label: 'Price: high to low' },
  { value: 'bestseller',label: 'Best sellers' },
  { value: 'featured',  label: 'Featured first' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: '',         label: 'All listings', statsKey: 'all'      },
  { value: 'ACTIVE',   label: 'Active',       statsKey: 'active'   },
  { value: 'DRAFT',    label: 'Draft',        statsKey: 'draft'    },
  { value: 'INACTIVE', label: 'Inactive',     statsKey: 'inactive' },
  { value: 'ARCHIVED', label: 'Archived',     statsKey: 'archived' },
] as const;

// ── Inner page (needs useSearchParams) ───────────────────────────────────────

function ProductsPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const qc           = useQueryClient();
  const { confirm, alert } = useDialog();

  const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));
  const urlStatus = searchParams.get('status') ?? '';
  const rawSort   = searchParams.get('sort') ?? '';
  const urlSort   = VALID_SORTS.has(rawSort as typeof SORT_OPTIONS[number]['value']) ? rawSort : 'newest';

  const [search,        setSearch]        = useState('');
  const [debouncedQ,    setDebouncedQ]    = useState('');
  const [page,          setPage]          = useState(1);
  const [selectedIds,   setSelectedIds]   = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [showSaleDialog,setShowSaleDialog]= useState(false);
  const [salePercent,   setSalePercent]   = useState(20);
  const [view,          setView]          = useState<'grid' | 'list'>('grid');

  // Load view preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_LS_KEY);
    if (stored === 'list' || stored === 'grid') setView(stored);
  }, []);

  const toggleView = (v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem(VIEW_LS_KEY, v);
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [urlStatus, urlSort]);

  const setUrlParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // ── Stats query ──────────────────────────────────────────────────────────────

  const { data: stats } = useQuery<ProductStats>({
    queryKey: ['admin-products-stats'],
    queryFn:  () => api.get<ProductStats>(API_ROUTES.ADMIN.PRODUCTS_STATS),
    staleTime: 2 * 60_000,
  });

  // ── Products list query ──────────────────────────────────────────────────────

  const listKey = ['admin-products', page, debouncedQ, urlStatus, urlSort];

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn:  async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: urlSort });
      if (debouncedQ) p.set('q',      debouncedQ);
      if (urlStatus)  p.set('status', urlStatus);
      return api.get<{ data: AdminProduct[]; pagination: { total: number } }>(`${API_ROUTES.ADMIN.PRODUCTS}?${p}`);
    },
  });

  const products = data?.data                ?? [];
  const total    = data?.pagination?.total   ?? 0;
  const from     = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to       = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleToggleActive = useCallback(async (p: AdminProduct) => {
    // Use bulk endpoint so both `isActive` AND `status` are synced atomically
    // (publish → status=ACTIVE; unpublish → status=INACTIVE)
    const action = p.isActive ? 'unpublish' : 'publish';
    await api.patch(API_ROUTES.ADMIN.PRODUCTS_BULK, { ids: [p.id], action });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-products'] }),
      qc.invalidateQueries({ queryKey: ['admin-products-stats'] }),
    ]);
  }, [qc]);

  const handleArchive = useCallback(async (p: AdminProduct) => {
    if (!await confirm(`Archive "${p.name}"? It will be hidden from the store.`, { confirmLabel: 'Archive', destructive: true })) return;
    await api.patch(API_ROUTES.ADMIN.PRODUCTS_BULK, { ids: [p.id], action: 'archive' });
    qc.invalidateQueries({ queryKey: ['admin-products'] });
    qc.invalidateQueries({ queryKey: ['admin-products-stats'] });
  }, [qc]);

  const handleToggleFeatured = useCallback(async (p: AdminProduct) => {
    await api.patch(API_ROUTES.ADMIN.PRODUCT(p.id), { isFeatured: !p.isFeatured });
    qc.invalidateQueries({ queryKey: ['admin-products'] });
  }, [qc]);

  const handleDelete = useCallback(async (p: AdminProduct) => {
    if (!await confirm(`Permanently delete "${p.name}"? This cannot be undone.`, { confirmLabel: 'Delete', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.PRODUCT(p.id));
    qc.invalidateQueries({ queryKey: ['admin-products'] });
    qc.invalidateQueries({ queryKey: ['admin-products-stats'] });
  }, [qc]);

  const executeBulk = async (action: string, payload?: Record<string, unknown>) => {
    setIsBulkLoading(true);
    try {
      const result = await api.patch<{ updated: number; action: string }>(API_ROUTES.ADMIN.PRODUCTS_BULK, {
        ids: selectedIds, action, payload,
      });
      await alert(`${result.updated} products ${result.action}`);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-products-stats'] });
    } catch {
      await alert('Bulk action failed. Please try again.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleExport = async () => {
    const res = await adminApi.post<Blob>(
      API_ROUTES.ADMIN.PRODUCTS_EXPORT,
      { ids: selectedIds },
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.length === products.length) setSelectedIds([]);
    else setSelectedIds(products.map((p) => p.id));
  };

  // ── List-view columns ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<AdminProduct>[]>(() => [
    {
      id:     'product',
      header: 'Product',
      size:   280,
      cell:   ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.primaryImageUrl ? (
            <Image src={row.original.primaryImageUrl} alt={row.original.name} width={40} height={40}
              className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted/10 flex items-center justify-center shrink-0 border border-border">
              <Package className="w-4 h-4 text-muted" />
            </div>
          )}
          <div className="min-w-0">
            <Link href={`/products/${row.original.id}/edit`}
              className="font-semibold text-secondary text-sm hover:text-primary transition-colors truncate block">
              {row.original.name}
            </Link>
            <p className="text-xs text-muted font-mono truncate">{row.original.slug}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'categoryName',
      header:      'Category',
      size:        130,
      cell:        ({ getValue }) =>
        getValue() ? (
          <span className="text-xs text-muted bg-muted/8 px-2 py-1 rounded-pill">{getValue() as string}</span>
        ) : <span className="text-muted">—</span>,
    },
    {
      accessorKey: 'basePrice',
      header:      'Price',
      size:        90,
      enableSorting: true,
      cell:        ({ getValue }) => (
        <span className="text-sm font-semibold text-secondary tabular-nums">
          {fmtAmount(getValue() as number | undefined)}
        </span>
      ),
    },
    {
      accessorKey: 'quantity',
      header:      'Stock',
      size:        80,
      cell:        ({ getValue }) => {
        const v = getValue() as number | null;
        if (v === null || v === undefined) return <span className="text-xs text-muted">Unlimited</span>;
        return (
          <span className={`text-sm font-semibold tabular-nums ${v === 0 ? 'text-red-600' : v < 5 ? 'text-amber-600' : 'text-secondary'}`}>
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header:      'Status',
      size:        100,
      cell:        ({ row }) => {
        const { status } = row.original;
        const styles: Record<string, string> = {
          ACTIVE:   'bg-green-100 text-green-700',
          INACTIVE: 'bg-amber-100 text-amber-700',
          DRAFT:    'bg-gray-100 text-gray-600',
          ARCHIVED: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : status === 'ARCHIVED' ? 'bg-red-500' : 'bg-gray-400'}`} />
            {capitalize(status)}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header:      'Added',
      size:        100,
      enableSorting: true,
      cell:        ({ getValue }) => (
        <span className="text-xs text-muted">{fmtDate(getValue() as string)}</span>
      ),
    },
    {
      id:   'actions',
      size: 150,
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/products/${row.original.id}/edit`}
            className="text-xs font-medium text-muted hover:text-primary px-2 py-1.5 rounded hover:bg-primary/5 transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/products/copy/${row.original.id}`}
            className="text-xs font-medium text-muted hover:text-primary px-2 py-1.5 rounded hover:bg-primary/5 transition-colors"
          >
            Copy
          </Link>
          <button
            type="button"
            onClick={() => handleToggleActive(row.original)}
            className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors"
            title={row.original.isActive ? 'Unpublish' : 'Publish'}
          >
            {row.original.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
    },
  ], [handleToggleActive]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Main column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Link
              href="/products/import"
              className="flex items-center gap-1.5 px-3 py-2 border border-border hover:border-primary text-secondary hover:text-primary text-sm font-semibold rounded-button transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Link>
            <Link
              href="/products/new"
              className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Link>

            {/* View toggle */}
            <div className="flex items-center border border-border rounded-button overflow-hidden">
              <button
                type="button"
                onClick={() => toggleView('grid')}
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-primary text-white' : 'text-muted hover:text-secondary hover:bg-muted/8'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleView('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-primary text-white' : 'text-muted hover:text-secondary hover:bg-muted/8'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile filter row (visible on < lg, replaces hidden sidebar) */}
        <div className="flex lg:hidden items-center gap-2 mb-4 flex-wrap">
          <select
            value={urlSort}
            onChange={(e) => setUrlParam('sort', e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={urlStatus}
            onChange={(e) => setUrlParam('status', e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-4 bg-secondary/5 border border-border rounded-xl">
            <span className="text-sm font-semibold text-secondary mr-1">
              {selectedIds.length} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={() => executeBulk('publish')}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Publish
            </button>
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={() => executeBulk('unpublish')}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" /> Unpublish
            </button>
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={() => setShowSaleDialog(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" /> Set sale
            </button>
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={handleExport}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              disabled={isBulkLoading}
              onClick={async () => {
                if (await confirm(`Archive ${selectedIds.length} product${selectedIds.length !== 1 ? 's' : ''}?`, { confirmLabel: 'Archive', destructive: true })) {
                  executeBulk('archive');
                }
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-auto text-xs text-muted hover:text-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        {view === 'grid' ? (
          <>
            {/* Grid header */}
            {products.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === products.length && products.length > 0}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300"
                  />
                  {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
                </label>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
                    <div className="aspect-square bg-muted/10" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-muted/10 rounded w-3/4" />
                      <div className="h-3 bg-muted/10 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Package className="w-12 h-12 text-muted/30 mb-4" />
                <p className="text-base font-semibold text-secondary mb-1">No products found</p>
                <p className="text-sm text-muted mb-6">
                  {urlStatus ? `No ${urlStatus.toLowerCase()} listings yet.` : 'Create your first product to get started.'}
                </p>
                <Link
                  href="/products/new"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedIds.includes(p.id)}
                    anySelected={selectedIds.length > 0}
                    onToggleSelect={handleToggleSelect}
                    onToggleActive={handleToggleActive}
                    onArchive={handleArchive}
                    onToggleFeatured={handleToggleFeatured}
                    onDelete={handleDelete}
                    clientBaseUrl={process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <DataTable
            data={products}
            columns={columns}
            isLoading={isLoading}
            selectable
            pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
            onSelectionChange={(rows) => setSelectedIds(rows.map((r) => r.id))}
            emptyTitle="No products found"
            emptyDesc="Create your first product to get started."
          />
        )}

        {/* Grid pagination */}
        {view === 'grid' && total > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <p className="text-sm text-muted">
              Showing <span className="font-semibold text-secondary">{from}–{to}</span> of{' '}
              <span className="font-semibold text-secondary">{fmtNum(total)}</span> products
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-border text-secondary disabled:opacity-40 hover:bg-muted/8 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${pg === page ? 'bg-primary text-white font-semibold' : 'text-secondary hover:bg-muted/8'}`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page === totalPages || totalPages === 0}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-border text-secondary disabled:opacity-40 hover:bg-muted/8 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-6 space-y-6">
          {/* Total count */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Overview</p>
            <p className="text-2xl font-bold text-secondary tabular-nums">{stats?.all ?? total}</p>
            <p className="text-xs text-muted mt-0.5">total listings</p>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Sort by</label>
            <select
              value={urlSort}
              onChange={(e) => setUrlParam('sort', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Listing status</p>
            <div className="space-y-0.5">
              {STATUS_FILTER_OPTIONS.map((opt) => {
                const count = stats ? (stats as unknown as Record<string, number>)[opt.statsKey] : undefined;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${urlStatus === opt.value ? 'bg-primary/8 text-primary' : 'text-secondary hover:bg-muted/8'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${urlStatus === opt.value ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                        {urlStatus === opt.value && <span className="block w-1.5 h-1.5 rounded-full bg-white mx-auto mt-px" />}
                      </span>
                      <input
                        type="radio"
                        name="status-filter"
                        value={opt.value}
                        checked={urlStatus === opt.value}
                        onChange={() => setUrlParam('status', opt.value)}
                        className="sr-only"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </span>
                    {count !== undefined && (
                      <span className={`text-xs font-semibold tabular-nums ${urlStatus === opt.value ? 'text-primary' : 'text-muted'}`}>
                        {fmtNum(count)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Add listing */}
          <Link
            href="/products/new"
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add a listing
          </Link>
        </div>
      </aside>

      {/* ── Sale dialog ──────────────────────────────────────────────────────── */}
      {showSaleDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaleDialog(false); }}
        >
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-secondary">Set sale price</h3>
            <p className="text-sm text-muted">
              Apply a discount to {selectedIds.length} selected product{selectedIds.length !== 1 ? 's' : ''}.
            </p>
            <div>
              <label className="text-xs font-medium text-secondary block mb-1.5">Discount percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={salePercent}
                  onChange={(e) => setSalePercent(Number(e.target.value))}
                  className="w-24 border border-border rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-sm text-muted">% off</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaleDialog(false)}
                className="px-4 py-2 text-sm text-muted hover:text-secondary rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaleDialog(false);
                  executeBulk('set-sale', { discountPercent: salePercent });
                }}
                className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
              >
                Apply to {selectedIds.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page wrapper (Suspense boundary for useSearchParams) ─────────────────────

export default function ProductsPage() {
  return (
    <>
      <AdminPageHeader
        title="Products"
        queryKey={['admin-products']}
      />
      <Suspense fallback={<div className="animate-pulse h-96 bg-muted/5 rounded-xl" />}>
        <ProductsPageInner />
      </Suspense>
    </>
  );
}
