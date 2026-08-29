'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, X, Eye, EyeOff, Package, Upload, LayoutGrid, List, ChevronLeft, ChevronRight, Tag, Download, Archive, ChevronDown, Type } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Select } from '@ezihubb/ui';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { ProductCard, type AdminProduct } from '../../../components/products/ProductCard';
import { api, adminApi } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate, capitalize, fmtNum } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';
import { FilterSelect } from '../../../components/ui/FilterSelect';

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

// Module scope, not an inline arrow: this feeds react-table's `getRowId`, and a
// new function identity on every render invalidates its row-model memoisation.
const productRowId = (p: AdminProduct) => p.id;

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc',label: 'Price: high to low' },
  { value: 'bestseller',label: 'Best sellers' },
  { value: 'featured',  label: 'Featured first' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL',      label: 'All listings', statsKey: 'all'      },
  { value: 'DRAFT',    label: 'Draft',        statsKey: 'draft'    },
  { value: 'ACTIVE',   label: 'Active',       statsKey: 'active'   },
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
  // Default to Active (not All) when the URL has no explicit ?status — "All
  // listings" is now its own real value ('ALL', set explicitly in the URL when
  // chosen) so it's distinguishable from "no filter chosen yet".
  const urlStatus = searchParams.get('status') ?? 'ACTIVE';
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
  const [editingOptionsOpen, setEditingOptionsOpen] = useState(false);
  const [showTagsDialog,  setShowTagsDialog]  = useState(false);
  const [tagsMode,        setTagsMode]        = useState<'add' | 'remove'>('add');
  const [tagsValue,       setTagsValue]       = useState('');
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [titleMode,       setTitleMode]       = useState<'add-front' | 'add-end' | 'find-replace' | 'delete'>('add-front');
  const [titleText,       setTitleText]       = useState('');
  const [titleFindText,   setTitleFindText]   = useState('');
  // Separate from titleText — "Replace with" is a different field than "Text
  // to add/delete" even though only one of them is visible at a time. Sharing
  // one state let whatever was typed for "Add to front" silently reappear in
  // "Replace with" after switching modes, since the value was never cleared.
  const [titleReplaceText, setTitleReplaceText] = useState('');

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
      // 'ALL' is a UI-only sentinel — omitting the param lets the API's own
      // default (everything except Draft) apply, same as before this default
      // changed from '' to 'ACTIVE'.
      if (urlStatus && urlStatus !== 'ALL') p.set('status', urlStatus);
      return api.get<{ data: AdminProduct[]; pagination: { total: number } }>(`${API_ROUTES.ADMIN.PRODUCTS}?${p}`);
    },
  });

  const products = data?.data                ?? [];
  const total    = data?.pagination?.total   ?? 0;
  const from     = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to       = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Selection is a list of ids; the list under it changes without asking —
  // a delete, an archive, a status tab, a search, a new page. Anything picked
  // that is no longer listed still counted towards the bulk bar and was still
  // sent to the bulk endpoint, so the Archived tab could read "4" with nothing
  // on screen and Publish would then publish four listings nobody could see.
  //
  // Reconciling against what actually loaded, rather than clearing on every
  // action, means deleting one of four still leaves the other three picked.
  // Switching tabs drops everything on its own, because none of those ids are
  // in the new list — no special case needed for it.
  useEffect(() => {
    const live = new Set(products.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => live.has(id));
      return next.length === prev.length ? prev : next;
    });
  // `products` is rebuilt every render; `data` is the thing that actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleToggleActive = useCallback(async (p: AdminProduct) => {
    // Use bulk endpoint so both `isActive` AND `status` are synced atomically
    // (publish → status=ACTIVE; unpublish → status=INACTIVE)
    const action = p.isActive ? 'unpublish' : 'publish';
    try {
      await api.patch(API_ROUTES.ADMIN.PRODUCTS_BULK, { ids: [p.id], action });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-products'] }),
        qc.invalidateQueries({ queryKey: ['admin-products-stats'] }),
      ]);
    } catch (err) {
      await alert((err as Error).message || 'Could not update this product. Please try again.', { variant: 'error' });
    }
  }, [qc]);

  const handleArchive = useCallback(async (p: AdminProduct) => {
    if (!await confirm(`Archive "${p.name}"? It will be hidden from the store.`, { confirmLabel: 'Archive', destructive: true })) return;
    try {
      await api.patch(API_ROUTES.ADMIN.PRODUCTS_BULK, { ids: [p.id], action: 'archive' });
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-products-stats'] });
    } catch (err) {
      await alert((err as Error).message || 'Could not archive this product. Please try again.', { variant: 'error' });
    }
  }, [qc]);

  const handleToggleFeatured = useCallback(async (p: AdminProduct, newValue: boolean) => {
    try {
      await api.patch(API_ROUTES.ADMIN.PRODUCT(p.id), { isFeatured: newValue });
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      await alert((err as Error).message || 'Could not update this product. Please try again.', { variant: 'error' });
    }
  }, [qc]);

  const handleDelete = useCallback(async (p: AdminProduct) => {
    if (!await confirm(`Permanently delete "${p.name}"? This cannot be undone.`, { confirmLabel: 'Delete', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.PRODUCT(p.id));
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-products-stats'] });
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this product. Please try again.', { variant: 'error' });
    }
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
    } catch (err) {
      await alert((err as Error).message || 'Bulk action failed. Please try again.', { variant: 'error' });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleExport = async () => {
    try {
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
    } catch (err) {
      await alert((err as Error).message || 'Export failed. Please try again.', { variant: 'error' });
    }
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
      // row.original, not getValue(): the sale sits beside basePrice on the
      // row and the accessor only hands over the one number.
      cell:        ({ row }) => {
        const { basePrice, sale } = row.original;
        return (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={`text-sm font-semibold tabular-nums ${sale ? 'text-badge-sale' : 'text-secondary'}`}>
              {fmtAmount(sale ? sale.price : basePrice)}
            </span>
            {sale && (
              <span className="text-xs text-muted line-through tabular-nums">
                {fmtAmount(sale.originalPrice)}
              </span>
            )}
          </span>
        );
      },
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
              placeholder="Search by title, tag, or SKU"
              className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-pill bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border hover:border-primary text-secondary hover:text-primary text-sm font-semibold rounded-pill transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Link>
            <Link
              href="/products/new"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-pill transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add a listing
            </Link>

            {/* View toggle */}
            <div className="flex items-center border border-border rounded-pill overflow-hidden">
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
          <FilterSelect
            value={urlSort}
            onChange={(v) => setUrlParam('sort', v)}
            options={SORT_OPTIONS as unknown as Array<{ value: string; label: string }>}
          />
          <FilterSelect
            value={urlStatus}
            onChange={(v) => setUrlParam('status', v)}
            options={STATUS_FILTER_OPTIONS as unknown as Array<{ value: string; label: string }>}
          />
        </div>

        {/* Bulk action bar — always visible, pill-styled, disabled until something is
            selected, matching real Etsy's persistent Renew/Deactivate/Delete/Editing
            options toolbar rather than only appearing on selection. */}
        <div className="relative flex flex-wrap items-center gap-2 mb-4">
          {selectedIds.length > 0 && (
            <span className="text-sm font-semibold text-secondary mr-1">{selectedIds.length}</span>
          )}
          <button
            type="button"
            disabled={selectedIds.length === 0 || isBulkLoading}
            onClick={() => executeBulk('publish')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Publish
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isBulkLoading}
            onClick={() => executeBulk('unpublish')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" /> Unpublish
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isBulkLoading}
            onClick={async () => {
              if (await confirm(`Archive ${selectedIds.length} product${selectedIds.length !== 1 ? 's' : ''}?`, { confirmLabel: 'Archive', destructive: true })) {
                executeBulk('archive');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>

          <div className="relative">
            <button
              type="button"
              disabled={selectedIds.length === 0 || isBulkLoading}
              onClick={() => setEditingOptionsOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              Editing options <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {editingOptionsOpen && selectedIds.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEditingOptionsOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-surface border border-border rounded-xl shadow-lg py-1.5">
                  <button
                    type="button"
                    onClick={() => { setEditingOptionsOpen(false); setShowTitleDialog(true); }}
                    className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-sm text-secondary hover:bg-muted/8"
                  >
                    <Type className="w-3.5 h-3.5" /> Edit titles
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingOptionsOpen(false); setShowTagsDialog(true); }}
                    className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-sm text-secondary hover:bg-muted/8"
                  >
                    <Tag className="w-3.5 h-3.5" /> Edit tags
                  </button>
                  {/* Edit descriptions/prices, change custom options/production partners/
                      processing profile/delivery profiles/return policies — real Etsy
                      offers these too, but no bulk API exists for them yet in this
                      codebase; omitted rather than wiring a dead menu item. */}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={selectedIds.length === 0 || isBulkLoading}
            onClick={() => setShowSaleDialog(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Tag className="w-3.5 h-3.5" /> Set sale
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isBulkLoading}
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-pill text-sm font-semibold text-secondary hover:bg-muted/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-auto text-xs text-muted hover:text-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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
                  {urlStatus && urlStatus !== 'ALL' ? `No ${urlStatus.toLowerCase()} listings yet.` : 'Create your first product to get started.'}
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
            getRowId={productRowId}
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
            <FilterSelect
              value={urlSort}
              onChange={(v) => setUrlParam('sort', v)}
              options={SORT_OPTIONS as unknown as Array<{ value: string; label: string }>}
              className="w-full"
            />
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
      <Modal isOpen={showSaleDialog} onClose={() => setShowSaleDialog(false)} size="sm">
        <ModalHeader onClose={() => setShowSaleDialog(false)}>Set sale price</ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted mb-4">
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
                className="w-24 border border-border rounded-input px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-muted">% off</span>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowSaleDialog(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowSaleDialog(false);
              executeBulk('set-sale', { discountPercent: salePercent });
            }}
          >
            Apply to {selectedIds.length}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Editing tags dialog ──────────────────────────────────────────────── */}
      <Modal isOpen={showTagsDialog} onClose={() => setShowTagsDialog(false)} size="sm">
        <ModalHeader onClose={() => setShowTagsDialog(false)}>
          Editing tags for {selectedIds.length} listing{selectedIds.length !== 1 ? 's' : ''}
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted mb-4">Add or remove a tag from all selected listings.</p>
          <div className="flex items-center gap-2">
            <Select
              value={tagsMode}
              onChange={(e) => setTagsMode(e.target.value as 'add' | 'remove')}
              className="w-28 shrink-0"
              options={[
                { value: 'add', label: 'Add' },
                { value: 'remove', label: 'Remove' },
              ]}
            />
            <input
              value={tagsValue}
              onChange={(e) => setTagsValue(e.target.value)}
              placeholder="Shape, colour, style, function, etc."
              className="flex-1 h-11 px-3.5 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowTagsDialog(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!tagsValue.trim() || isBulkLoading}
            onClick={() => {
              setShowTagsDialog(false);
              executeBulk('edit-tags', { mode: tagsMode, tag: tagsValue.trim() });
              setTagsValue('');
            }}
          >
            Apply
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Editing title dialog ─────────────────────────────────────────────── */}
      <Modal isOpen={showTitleDialog} onClose={() => setShowTitleDialog(false)} size="sm">
        <ModalHeader onClose={() => setShowTitleDialog(false)}>
          Editing title for {selectedIds.length} listing{selectedIds.length !== 1 ? 's' : ''}
        </ModalHeader>
        <ModalBody>
          <div className="flex items-center gap-2 mb-3">
            <Select
              value={titleMode}
              onChange={(e) => setTitleMode(e.target.value as typeof titleMode)}
              className="w-44 shrink-0"
              options={[
                { value: 'add-front', label: 'Add to front' },
                { value: 'add-end', label: 'Add to end' },
                { value: 'find-replace', label: 'Find and replace' },
                { value: 'delete', label: 'Delete' },
              ]}
            />
            {titleMode === 'find-replace' ? (
              <input
                value={titleFindText}
                onChange={(e) => setTitleFindText(e.target.value)}
                placeholder="Text to find"
                className="flex-1 h-11 px-3.5 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <input
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                placeholder={titleMode === 'delete' ? 'Text to delete' : 'Text to add'}
                className="flex-1 h-11 px-3.5 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
          {titleMode === 'find-replace' && (
            <input
              value={titleReplaceText}
              onChange={(e) => setTitleReplaceText(e.target.value)}
              placeholder="Replace with"
              className="w-full h-11 px-3.5 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowTitleDialog(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={(titleMode === 'find-replace' ? !titleFindText.trim() : !titleText.trim()) || isBulkLoading}
            onClick={() => {
              setShowTitleDialog(false);
              executeBulk('edit-title', {
                mode: titleMode,
                text: titleMode === 'find-replace' ? titleReplaceText : titleText,
                findText: titleFindText || undefined,
              });
              setTitleText('');
              setTitleFindText('');
              setTitleReplaceText('');
            }}
          >
            Apply
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ── Page wrapper (Suspense boundary for useSearchParams) ─────────────────────

export default function ProductsPage() {
  return (
    <>
      <AdminPageHeader
        title="Listings"
        queryKey={['admin-products']}
      />
      <Suspense fallback={<div className="animate-pulse h-96 bg-muted/5 rounded-xl" />}>
        <ProductsPageInner />
      </Suspense>
    </>
  );
}
