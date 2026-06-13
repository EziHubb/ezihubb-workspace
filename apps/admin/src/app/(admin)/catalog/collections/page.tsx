'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, X, Save, Trash2, GripVertical,
  ChevronLeft, ChevronRight, Eye, EyeOff, Package,
} from 'lucide-react';
import Image from 'next/image';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtFixed, safeArr } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';
import { FilterSelect } from '../../../../components/ui/FilterSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSnippet {
  id:       string;
  name:     string;
  imageUrl?: string;
  price:    number;
}

interface Collection {
  id:          string;
  name:        string;
  slug:        string;
  description?: string;
  imageUrl?:   string;
  occasion?:   string;
  sortOrder:   number;
  isActive:    boolean;
  startDate?:  string;
  endDate?:    string;
  productCount?: number;
  products?:   ProductSnippet[];
  createdAt:   string;
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

// ── Occasion options ──────────────────────────────────────────────────────────

const OCCASION_OPTIONS = [
  { value: '',           label: 'None' },
  { value: 'wedding',    label: 'Wedding' },
  { value: 'birthday',   label: 'Birthday' },
  { value: 'holiday',    label: 'Holiday' },
  { value: 'anniversary',label: 'Anniversary' },
  { value: 'baby',       label: 'Baby Shower' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'housewarming',label: 'Housewarming' },
  { value: 'seasonal',   label: 'Seasonal' },
  { value: 'custom',     label: 'Custom' },
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Product search row ────────────────────────────────────────────────────────

function ProductSearchRow({ onAdd }: { onAdd: (p: ProductSnippet) => void }) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<ProductSnippet[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (query: string) => {
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.get<ProductSnippet[]>(API_ROUTES.ADMIN.PRODUCTS, { params: { q: query, limit: 10 } });
      setResults(data.slice(0, 10));
    } catch { setResults([]); } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products to add…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {loading && <span className="text-xs text-muted">…</span>}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-surface border border-border rounded-card shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onAdd(p); setQ(''); setResults([]); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/5 transition-colors"
            >
              {p.imageUrl
                ? <Image src={p.imageUrl} alt={p.name} width={32} height={32} className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                : <div className="w-8 h-8 rounded-lg bg-muted/10 flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-muted" /></div>
              }
              <span className="flex-1 text-sm font-medium text-secondary truncate">{p.name}</span>
              <span className="text-xs text-muted">${fmtFixed(p.price, 2)}</span>
              <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slide-over form ───────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  slug:        string;
  description: string;
  occasion:    string;
  sortOrder:   number;
  isActive:    boolean;
  startDate:   string;
  endDate:     string;
  products:    ProductSnippet[];
}

function CollectionSlideOver({
  collection,
  onClose,
  onSave,
  onDelete,
}: {
  collection: Collection | 'new';
  onClose:    () => void;
  onSave:     (data: Partial<Collection>) => Promise<void>;
  onDelete?:  (id: string) => Promise<void>;
}) {
  const { confirm } = useDialog();
  const isNew = collection === 'new';
  const col   = isNew ? null : (collection as Collection);

  const [form,       setForm]       = useState<FormState>(() => ({
    name:        col?.name        ?? '',
    slug:        col?.slug        ?? '',
    description: col?.description ?? '',
    occasion:    col?.occasion    ?? '',
    sortOrder:   col?.sortOrder   ?? 0,
    isActive:    col?.isActive    ?? true,
    startDate:   col?.startDate   ? col.startDate.slice(0, 10) : '',
    endDate:     col?.endDate     ? col.endDate.slice(0, 10)   : '',
    products:    safeArr(col?.products),
  }));
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleNameChange = (v: string) => {
    setField('name', v);
    if (!slugEdited) setField('slug', toSlug(v));
  };

  const addProduct = (p: ProductSnippet) => {
    if (form.products.some((x) => x.id === p.id)) return;
    setField('products', [...form.products, p]);
  };

  const removeProduct = (id: string) =>
    setField('products', form.products.filter((p) => p.id !== id));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        id:          col?.id,
        name:        form.name,
        slug:        form.slug,
        description: form.description || undefined,
        occasion:    form.occasion    || undefined,
        sortOrder:   form.sortOrder,
        isActive:    form.isActive,
        startDate:   form.startDate || undefined,
        endDate:     form.endDate   || undefined,
        products:    form.products,
      });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!col?.id) return;
    if (!await confirm(`Delete collection "${col.name}"? This cannot be undone.`, { confirmLabel: 'Delete', destructive: true })) return;
    setDeleting(true);
    try {
      await onDelete?.(col.id);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-button hover:bg-muted/10 transition-colors text-muted"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-secondary text-sm">
            {isNew ? 'New Collection' : `Edit: ${col!.name}`}
          </h3>
          {!isNew && <StatusBadge isActive={col!.isActive} />}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Basic info */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Basic Info</h4>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Summer Wedding Gifts"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => { setSlugEdited(true); setField('slug', e.target.value); }}
                className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
                placeholder="Short description…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Occasion */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Occasion</label>
                <select
                  value={form.occasion}
                  onChange={(e) => setField('occasion', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {OCCASION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Sort order */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Sort Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setField('sortOrder', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* End date */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField('endDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField('isActive', !form.isActive)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-secondary flex items-center gap-1.5">
                {form.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.isActive ? 'Active (visible in store)' : 'Inactive (hidden)'}
              </span>
            </div>
          </div>

          {/* Products section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">
                Products ({form.products.length})
              </h4>
            </div>

            <ProductSearchRow onAdd={addProduct} />

            {form.products.length > 0 ? (
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {form.products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-button bg-background border border-border group"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted/30 group-hover:text-muted shrink-0 cursor-grab" />
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.name} width={32} height={32} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-lg bg-muted/10 flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-muted" /></div>
                    }
                    <span className="flex-1 text-sm text-secondary truncate">{p.name}</span>
                    <span className="text-xs text-muted">${fmtFixed(p.price, 2)}</span>
                    <button
                      type="button"
                      onClick={() => removeProduct(p.id)}
                      className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted text-center py-4 border border-dashed border-border rounded-button">
                No products added yet. Search above to add products.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : (isNew ? 'Create Collection' : 'Save Changes')}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>

          {!isNew && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto flex items-center gap-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-button transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function CollectionsPage() {
  const qc = useQueryClient();

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [debouncedQ,   setDebouncedQ]   = useState('');
  const [occasionFilt, setOccasionFilt] = useState('');
  const [statusFilt,   setStatusFilt]   = useState<'' | 'active' | 'inactive'>('');
  const [slideOver,    setSlideOver]    = useState<Collection | 'new' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ['admin-collections', page, debouncedQ, occasionFilt, statusFilt];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (debouncedQ)   params['q']        = debouncedQ;
      if (occasionFilt) params['occasion'] = occasionFilt;
      if (statusFilt)   params['isActive'] = statusFilt === 'active' ? 'true' : 'false';
      return api.get<{ data: Collection[]; total: number; pages: number }>(API_ROUTES.ADMIN.COLLECTIONS, { params });
    },
  });

  const collections = safeArr(data?.data);
  const totalPages  = data?.pages ?? 1;
  const total       = data?.total ?? 0;

  const handleSave = async (payload: Partial<Collection>) => {
    if (payload.id) {
      await api.patch(API_ROUTES.ADMIN.COLLECTION(payload.id), payload);
    } else {
      await api.post(API_ROUTES.ADMIN.COLLECTIONS, payload);
    }
    qc.invalidateQueries({ queryKey: ['admin-collections'] });
    setSlideOver(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(API_ROUTES.ADMIN.COLLECTION(id));
    } catch (e: unknown) {
      throw new Error((e as Error).message ?? 'Delete failed');
    }
    qc.invalidateQueries({ queryKey: ['admin-collections'] });
    setSlideOver(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Collections"
        subtitle={`${total} collections total`}
        actions={
          <button
            type="button"
            onClick={() => setSlideOver('new')}
            className="flex items-center gap-1.5 text-sm font-semibold bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Collection
          </button>
        }
        queryKey={['admin-collections']}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search collections…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Occasion filter */}
        <FilterSelect value={occasionFilt} onChange={(v) => { setOccasionFilt(v); setPage(1); }} options={OCCASION_OPTIONS} />

        {/* Status filter */}
        <FilterSelect value={statusFilt} onChange={(v) => { setStatusFilt(v as '' | 'active' | 'inactive'); setPage(1); }} options={[{value:'',label:'All Statuses'},{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]} />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {['Collection', 'Occasion', 'Products', 'Sort', 'Date Range', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : collections.length === 0
              ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted">
                        <Package className="w-8 h-8 opacity-20" />
                        <p className="font-medium">No collections found</p>
                        {(search || occasionFilt || statusFilt) && (
                          <button type="button" onClick={() => { setSearch(''); setOccasionFilt(''); setStatusFilt(''); }}
                            className="text-xs text-primary hover:underline">Clear filters</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              : collections.map((col) => (
                  <tr
                    key={col.id}
                    className="hover:bg-muted/3 transition-colors cursor-pointer"
                    onClick={() => setSlideOver(col)}
                  >
                    {/* Name + image */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {col.imageUrl
                          ? <Image src={col.imageUrl} alt={col.name} width={36} height={36} className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
                          : <div className="w-9 h-9 rounded-lg bg-muted/10 flex items-center justify-center shrink-0 border border-border"><Package className="w-4 h-4 text-muted" /></div>
                        }
                        <div className="min-w-0">
                          <p className="font-semibold text-secondary truncate">{col.name}</p>
                          <p className="text-xs text-muted font-mono truncate">{col.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Occasion */}
                    <td className="px-4 py-3">
                      {col.occasion ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full capitalize">{col.occasion}</span>
                      ) : <span className="text-muted">—</span>}
                    </td>

                    {/* Products count */}
                    <td className="px-4 py-3 text-muted tabular-nums font-medium">
                      {col.productCount ?? 0}
                    </td>

                    {/* Sort order */}
                    <td className="px-4 py-3 text-muted tabular-nums">{col.sortOrder}</td>

                    {/* Date range */}
                    <td className="px-4 py-3 text-xs text-muted">
                      {col.startDate || col.endDate
                        ? <>{col.startDate ? col.startDate.slice(0, 10) : '∞'} → {col.endDate ? col.endDate.slice(0, 10) : '∞'}</>
                        : <span>Always on</span>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge isActive={col.isActive} />
                    </td>

                    {/* Edit button */}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSlideOver(col); }}
                        className="text-xs text-muted hover:text-primary px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted">
              Page {page} of {totalPages} · {total} collections
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-muted/10 disabled:opacity-30 text-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const n = start + i;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 text-sm rounded ${n === page ? 'bg-primary text-white font-semibold' : 'text-muted hover:bg-muted/10'} transition-colors`}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-muted/10 disabled:opacity-30 text-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over panel */}
      {slideOver !== null && (
        <CollectionSlideOver
          collection={slideOver}
          onClose={() => setSlideOver(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
