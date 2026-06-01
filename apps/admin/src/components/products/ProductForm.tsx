'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import { clientFetch } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductPayload {
  id?:           string;
  name:          string;
  slug:          string;
  description:   string;
  price:         number;
  comparePrice?: number;
  sku?:          string;
  stock:         number;
  isActive:      boolean;
  categoryId?:   string;
}

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  mode:       'create' | 'edit';
  initial?:   Partial<ProductPayload>;
  onSuccess?: (product: ProductPayload) => void;
}

export function ProductForm({ mode, initial, onSuccess }: ProductFormProps) {
  const router = useRouter();

  const [form,       setForm]       = useState<ProductPayload>({
    name:        initial?.name        ?? '',
    slug:        initial?.slug        ?? '',
    description: initial?.description ?? '',
    price:       initial?.price       ?? 0,
    comparePrice:initial?.comparePrice,
    sku:         initial?.sku         ?? '',
    stock:       initial?.stock       ?? 0,
    isActive:    initial?.isActive    ?? true,
    categoryId:  initial?.categoryId,
  });
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const set = <K extends keyof ProductPayload>(k: K, v: ProductPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleNameChange = (v: string) => {
    set('name', v);
    if (!slugEdited) set('slug', toSlug(v));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name  = 'Name is required';
    if (!form.slug.trim()) e.slug  = 'Slug is required';
    if (form.price < 0)    e.price = 'Price cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url    = initial?.id ? `/admin/products/${initial.id}` : '/admin/products';
      const method = initial?.id ? 'PATCH' : 'POST';
      const res    = await clientFetch(url, { method, body: JSON.stringify(form) });
      const body   = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Save failed');
      const saved  = (body.data ?? body) as ProductPayload;
      onSuccess?.(saved);
      if (mode === 'create') router.push(`/products/${saved.id}/edit`);
    } catch (e: unknown) {
      setErrors({ _: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-[720px] space-y-5">
      {/* Core info */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
        <h4 className="font-semibold text-secondary text-sm">Product Info</h4>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input value={form.name} onChange={(e) => handleNameChange(e.target.value)}
            className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`} placeholder="e.g. Custom Wooden Frame" />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Slug</label>
          <input value={form.slug} onChange={(e) => { setSlugEdited(true); set('slug', e.target.value); }}
            className={`${inputCls} font-mono ${errors.slug ? 'border-red-400' : ''}`} />
          {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug}</p>}
          <p className="text-xs text-muted/70 mt-1">URL: /products/{form.slug}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
            rows={4} className={`${inputCls} resize-none`} placeholder="Product description…" />
        </div>
      </div>

      {/* Pricing & Inventory */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
        <h4 className="font-semibold text-secondary text-sm">Pricing & Inventory</h4>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input type="number" min={0} step={0.01} value={form.price}
                onChange={(e) => set('price', Number(e.target.value))}
                className={`${inputCls} pl-7 ${errors.price ? 'border-red-400' : ''}`} />
            </div>
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Compare Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input type="number" min={0} step={0.01} value={form.comparePrice ?? ''}
                onChange={(e) => set('comparePrice', e.target.value ? Number(e.target.value) : undefined)}
                className={`${inputCls} pl-7`} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Stock</label>
            <input type="number" min={0} value={form.stock}
              onChange={(e) => set('stock', Number(e.target.value))}
              className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">SKU</label>
          <input value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)}
            className={`${inputCls} font-mono w-48`} placeholder="MLH-XXXX" />
        </div>
      </div>

      {/* Status */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set('isActive', !form.isActive)}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-border'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <div>
            <p className="text-sm font-medium text-secondary">{form.isActive ? 'Published' : 'Draft'}</p>
            <p className="text-xs text-muted">{form.isActive ? 'Visible in the store' : 'Hidden from customers'}</p>
          </div>
        </div>
      </div>

      {errors._ && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-button px-4 py-3">{errors._}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.push('/products')}
          className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
