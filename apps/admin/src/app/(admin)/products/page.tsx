'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, X, Eye, EyeOff, Package, Upload } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { BulkActionBar } from '../../../components/products/BulkActionBar';
import { clientFetch, API_BASE } from '../../../lib/api';
import { fmtAmount } from '../../../lib/fmt';
import { getSession } from 'next-auth/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id:           string;
  name:         string;
  slug:         string;
  price:        number;
  sku?:         string;
  stock:        number;
  isActive:     boolean;
  imageUrl?:    string;
  categoryName?: string;
  createdAt:    string;
  rating?:      number;
  reviewCount?: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const qc = useQueryClient();
  const [page,            setPage]            = useState(1);
  const [search,          setSearch]          = useState('');
  const [debouncedQ,      setDebouncedQ]      = useState('');
  const [status,          setStatus]          = useState('');
  const [category,        setCategory]        = useState('');
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);
  const [isBulkLoading,   setIsBulkLoading]   = useState(false);
  const [showSaleDialog,  setShowSaleDialog]  = useState(false);
  const [salePercent,     setSalePercent]     = useState(20);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const listKey = ['admin-products', page, debouncedQ, status, category];

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn:  async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedQ) p.set('q',          debouncedQ);
      if (status)     p.set('isActive',   status);
      if (category)   p.set('category',   category);
      const res  = await clientFetch(`/admin/products?${p}`);
      const body = await res.json();
      return body as { data: Product[]; total: number };
    },
  });

  const products = data?.data ?? [];
  const total    = data?.total ?? 0;

  const handleToggleActive = async (p: Product) => {
    await clientFetch(`/admin/products/${p.id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ isActive: !p.isActive }),
    });
    qc.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const executeBulk = async (action: string, payload?: Record<string, unknown>) => {
    setIsBulkLoading(true);
    try {
      const res  = await clientFetch('/admin/products/bulk', {
        method: 'PATCH',
        body:   JSON.stringify({ ids: selectedIds, action, payload }),
      });
      const body = await res.json() as { data?: { updated: number; action: string }; updated?: number; action?: string };
      const result = 'data' in body && body.data ? body.data : body as { updated: number; action: string };
      alert(`${result.updated} products ${result.action}`);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    } catch {
      alert('Bulk action failed. Please try again.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleExport = async () => {
    const session = await getSession();
    const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;
    const res     = await fetch(`${API_BASE}/admin/products/export`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      id:   'product',
      header: 'Product',
      size:   280,
      cell:   ({ row }: { row: { original: Product } }) => (
        <div className="flex items-center gap-3">
          {row.original.imageUrl ? (
            <Image src={row.original.imageUrl} alt={row.original.name} width={40} height={40}
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
      cell:        ({ getValue }: { getValue: () => unknown }) =>
        getValue() ? (
          <span className="text-xs text-muted bg-muted/8 px-2 py-1 rounded-pill">{getValue() as string}</span>
        ) : <span className="text-muted">—</span>,
    },
    {
      accessorKey: 'price',
      header:      'Price',
      size:        90,
      enableSorting: true,
      cell:        ({ getValue }: { getValue: () => unknown }) => (
        <span className="text-sm font-semibold text-secondary tabular-nums">
          {fmtAmount(getValue() as number | undefined)}
        </span>
      ),
    },
    {
      accessorKey: 'stock',
      header:      'Stock',
      size:        80,
      enableSorting: true,
      cell:        ({ getValue }: { getValue: () => unknown }) => {
        const v = getValue() as number;
        return (
          <span className={`text-sm font-semibold tabular-nums ${v === 0 ? 'text-red-600' : v < 10 ? 'text-amber-600' : 'text-secondary'}`}>
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header:      'Status',
      size:        100,
      cell:        ({ getValue }: { getValue: () => unknown }) => {
        const active = getValue() as boolean;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
            {active ? 'Active' : 'Draft'}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header:      'Added',
      size:        100,
      enableSorting: true,
      cell:        ({ getValue }: { getValue: () => unknown }) => (
        <span className="text-xs text-muted">{format(new Date(getValue() as string), 'MMM d, yyyy')}</span>
      ),
    },
    {
      id:   'actions',
      size: 150,
      header: '',
      cell: ({ row }: { row: { original: Product } }) => (
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
            title="Copy this product into a new listing"
          >
            Copy
          </Link>
          <button
            type="button"
            onClick={() => handleToggleActive(row.original)}
            className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors"
            title={row.original.isActive ? 'Unpublish' : 'Publish'}
          >
            {row.original.isActive
              ? <EyeOff className="w-3.5 h-3.5" />
              : <Eye className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      ),
    },
  ], []);

  return (
    <>
      <AdminPageHeader
        title="Products"
        subtitle={`${total.toLocaleString()} products`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/products/import"
              className="flex items-center gap-1.5 px-4 py-2 border border-border hover:border-primary text-secondary hover:text-primary text-sm font-semibold rounded-button transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Link>
            <Link
              href="/products/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
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

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Draft</option>
        </select>

        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All categories</option>
        </select>

        {(status || category) && (
          <button
            type="button"
            onClick={() => { setStatus(''); setCategory(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      <DataTable
        data={products}
        columns={columns}
        isLoading={isLoading}
        selectable
        pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
        onSelectionChange={(rows) => setSelectedIds(rows.map((r) => r.id))}
        bulkActions={
          selectedIds.length > 0 ? (
            <BulkActionBar
              count={selectedIds.length}
              isLoading={isBulkLoading}
              onPublish={() => executeBulk('publish')}
              onUnpublish={() => executeBulk('unpublish')}
              onArchive={() => {
                if (confirm(`Archive ${selectedIds.length} product${selectedIds.length !== 1 ? 's' : ''}? They will be hidden from the store.`)) {
                  executeBulk('archive');
                }
              }}
              onSetSale={() => setShowSaleDialog(true)}
              onExport={handleExport}
            />
          ) : undefined
        }
        emptyTitle="No products found"
        emptyDesc="Create your first product to get started."
      />

      {/* Set sale dialog */}
      {showSaleDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaleDialog(false); }}
        >
          <div className="bg-background rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-secondary">Set sale price</h3>
            <p className="text-sm text-muted">
              Apply a discount to {selectedIds.length} selected product{selectedIds.length !== 1 ? 's' : ''}.
              Current prices become the strikethrough &ldquo;was&rdquo; prices.
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
              <p className="text-xs text-muted mt-1">e.g. $27.99 at 20% off → $22.39</p>
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
                Apply to {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
