'use client';

import { useState, useEffect } from 'react';
import { X, Percent, Globe2, Tag } from 'lucide-react';
import { ListingPicker, type PickedProduct } from './ListingPicker';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

export interface SaleFormData {
  description:        string;
  value:               number;
  scope:               'SHOP_WIDE' | 'SPECIFIC_LISTINGS';
  productIds:          string[];
  country:             string;
  startsAt:            string;
  expiresAt:           string;
  termsAndConditions:  string;
}

export interface SalePromotion {
  id:                  string;
  description:         string | null;
  value:                number;
  scope:               'SHOP_WIDE' | 'SPECIFIC_LISTINGS';
  productIds?:          string[];
  country?:             string | null;
  startsAt?:            string | null;
  expiresAt?:           string | null;
  termsAndConditions?:  string | null;
}

const EMPTY: SaleFormData = {
  description: '', value: 15, scope: 'SHOP_WIDE', productIds: [],
  country: '', startsAt: '', expiresAt: '', termsAndConditions: '',
};

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted/70 mt-1">{hint}</p>}
    </div>
  );
}

interface SetUpSaleModalProps {
  sale?:      SalePromotion | null;
  initialProducts?: PickedProduct[];
  onClose:    () => void;
  onSave:     (data: SaleFormData, id?: string) => Promise<void>;
}

/** Etsy "Set up a sale" — a shop-wide or listing-specific auto-apply discount, no buyer code. */
export function SetUpSaleModal({ sale, initialProducts = [], onClose, onSave }: SetUpSaleModalProps) {
  const isEdit = !!sale?.id;

  const [form, setForm] = useState<SaleFormData>(() =>
    isEdit ? {
      description:        sale.description ?? '',
      value:               sale.value,
      scope:               sale.scope,
      productIds:          sale.productIds ?? [],
      country:             sale.country ?? '',
      startsAt:            sale.startsAt ? sale.startsAt.slice(0, 10) : '',
      expiresAt:           sale.expiresAt ? sale.expiresAt.slice(0, 10) : '',
      termsAndConditions:  sale.termsAndConditions ?? '',
    } : { ...EMPTY }
  );
  const [pickedProducts, setPickedProducts] = useState<PickedProduct[]>(initialProducts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Hydrate the picker with the sale's already-saved listings on edit — the
  // picker only knows about `initialProducts` (never passed by the caller),
  // so without this it renders as if nothing were selected. If the seller
  // then picked even one new listing without noticing, onChange below would
  // overwrite `form.productIds` and silently drop every existing listing.
  useEffect(() => {
    if (!isEdit || sale.scope !== 'SPECIFIC_LISTINGS' || !sale.productIds?.length) return;
    let cancelled = false;
    Promise.all(sale.productIds.map((id) => api.get<PickedProduct>(API_ROUTES.ADMIN.PRODUCT(id)).catch(() => null)))
      .then((results) => {
        if (!cancelled) setPickedProducts(results.filter((p): p is PickedProduct => !!p));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-hydrate if the sale identity changes, not on every keystroke
  }, [sale?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = <K extends keyof SaleFormData>(k: K, v: SaleFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Sale name is required';
    if (form.value <= 0 || form.value > 90) e.value = 'Must be between 1 and 90%';
    if (form.scope === 'SPECIFIC_LISTINGS' && form.productIds.length === 0) e.productIds = 'Select at least one listing';
    if (form.startsAt && form.expiresAt && new Date(form.startsAt) >= new Date(form.expiresAt)) {
      e.expiresAt = 'End date must be after start date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form, sale?.id);
    } catch { /* handled by parent */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-surface rounded-card border border-border shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="font-bold text-secondary text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            {isEdit ? 'Edit sale' : 'Set up a sale'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Field label="Sale name" required hint="Shown to you only, e.g. Summer Sale">
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputCls} ${errors.description ? 'border-red-400' : ''}`}
              placeholder="e.g. Summer Sale"
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </Field>

          <Field label="Discount" required hint="No code required — applied automatically at checkout">
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="number" min={1} max={90}
                value={form.value}
                onChange={(e) => set('value', Number(e.target.value))}
                className={`${inputCls} pl-8 ${errors.value ? 'border-red-400' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">% off</span>
            </div>
            {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
          </Field>

          <Field label="Which listings">
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => set('scope', 'SHOP_WIDE')}
                className={`flex-1 px-3 py-2 rounded-button border-2 text-sm font-semibold transition-colors ${form.scope === 'SHOP_WIDE' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40'}`}>
                All listings
              </button>
              <button type="button" onClick={() => set('scope', 'SPECIFIC_LISTINGS')}
                className={`flex-1 px-3 py-2 rounded-button border-2 text-sm font-semibold transition-colors ${form.scope === 'SPECIFIC_LISTINGS' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40'}`}>
                Select listings
              </button>
            </div>
            {form.scope === 'SPECIFIC_LISTINGS' && (
              <>
                <ListingPicker
                  selected={pickedProducts}
                  onChange={(products) => { setPickedProducts(products); set('productIds', products.map((p) => p.id)); }}
                />
                {errors.productIds && <p className="text-xs text-red-600 mt-1">{errors.productIds}</p>}
              </>
            )}
          </Field>

          <Field label="Where valid" hint="Leave blank for everywhere">
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                value={form.country}
                onChange={(e) => set('country', e.target.value.toUpperCase().slice(0, 2))}
                className={`${inputCls} pl-8`}
                placeholder="Everywhere (e.g. US, VN)"
                maxLength={2}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" hint="Optional — starts immediately if blank">
              <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={inputCls} />
            </Field>
            <Field label="End date" hint="Etsy sales run up to 30 days">
              <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className={`${inputCls} ${errors.expiresAt ? 'border-red-400' : ''}`} />
              {errors.expiresAt && <p className="text-xs text-red-600 mt-1">{errors.expiresAt}</p>}
            </Field>
          </div>

          <Field label="Terms and conditions" hint="Shown to buyers on eligible listings">
            <textarea
              value={form.termsAndConditions}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="e.g. Discount applied automatically at checkout, while supplies last"
              maxLength={500}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : (isEdit ? 'Save sale' : 'Confirm and create sale')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
