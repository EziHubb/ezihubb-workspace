'use client';

import { useState } from 'react';
import { Percent, ShoppingBag } from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';

export interface OrderMinimumFormData {
  description:    string;
  value:           number;
  minOrderAmount:  number;
  startsAt:        string;
  expiresAt:       string;
}

export interface OrderMinimumPromotion {
  id:              string;
  description:      string | null;
  value:             number;
  minOrderAmount:    number | null;
  startsAt?:         string | null;
  expiresAt?:        string | null;
}

const EMPTY: OrderMinimumFormData = {
  description: '', value: 10, minOrderAmount: 50, startsAt: '', expiresAt: '',
};

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

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

interface OrderMinimumModalProps {
  promotion?: OrderMinimumPromotion | null;
  onClose:    () => void;
  onSave:     (data: OrderMinimumFormData, id?: string) => Promise<void>;
}

/**
 * Etsy "Create your discount" — a shop-wide-only auto-apply sale gated by a
 * minimum order amount, distinct from the plain "Run a sale" flow. Per the
 * reference: this discount type can't be scoped to specific listings.
 */
export function OrderMinimumModal({ promotion, onClose, onSave }: OrderMinimumModalProps) {
  const isEdit = !!promotion?.id;
  const [form, setForm]     = useState<OrderMinimumFormData>(() =>
    isEdit ? {
      description:     promotion.description ?? '',
      value:            promotion.value,
      minOrderAmount:   promotion.minOrderAmount ?? 0,
      startsAt:         promotion.startsAt ? promotion.startsAt.slice(0, 10) : '',
      expiresAt:        promotion.expiresAt ? promotion.expiresAt.slice(0, 10) : '',
    } : { ...EMPTY }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof OrderMinimumFormData>(k: K, v: OrderMinimumFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Discount name is required';
    if (form.value <= 0 || form.value > 90) e.value = 'Must be between 1 and 90%';
    if (form.minOrderAmount <= 0) e.minOrderAmount = 'Enter an order minimum greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form, promotion?.id);
    } catch { /* handled by parent */ } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeroHeader
        icon={<ShoppingBag className="w-7 h-7" />}
        title={isEdit ? 'Edit discount' : 'Create your discount'}
        subtitle="Set your discount, your order minimum, and how long the offer will run. Applies to your whole shop — no code needed for the discount."
        band="periwinkle"
        onClose={onClose}
      />
      <div className="overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          <Field label="Discount name" required hint="Shown to you only, to track this offer">
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputCls} ${errors.description ? 'border-red-400' : ''}`}
              placeholder="e.g. Spend more, save more"
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </Field>

          <Field label="Discount amount" required>
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

          <Field label="Order minimum" required hint="The subtotal a buyer must reach to unlock this discount">
            <input
              type="number" min={1}
              value={form.minOrderAmount}
              onChange={(e) => set('minOrderAmount', Number(e.target.value))}
              className={`${inputCls} ${errors.minOrderAmount ? 'border-red-400' : ''}`}
            />
            {errors.minOrderAmount && <p className="text-xs text-red-600 mt-1">{errors.minOrderAmount}</p>}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" hint="Optional — starts immediately if blank">
              <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={inputCls} />
            </Field>
            <Field label="End date" hint="Optional — leave blank for no end date">
              <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} loading={saving}>{isEdit ? 'Save discount' : 'Create discount'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
