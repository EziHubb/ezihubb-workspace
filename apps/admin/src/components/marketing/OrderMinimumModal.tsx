'use client';

import { useState } from 'react';
import { localDateInputValue } from '../../lib/promo-dates';
import { Globe2, ShoppingBag } from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';
import { COUNTRIES } from '@ezihubb/constants';

export interface OrderMinimumFormData {
  description:    string;
  value:           number;
  minOrderAmount:  number;
  country:         string;
  startsAt:        string;
  expiresAt:       string;
}

export interface OrderMinimumPromotion {
  id:              string;
  description:      string | null;
  value:             number;
  minOrderAmount:    number | null;
  country?:          string | null;
  startsAt?:         string | null;
  expiresAt?:        string | null;
}

const EMPTY: OrderMinimumFormData = {
  description: '', value: 25, minOrderAmount: 50, country: '', startsAt: '', expiresAt: '',
};

const DISCOUNT_PRESETS = [10, 15, 20, 25, 30, 35, 40, 45, 50];

/** An existing promotion (created before this preset dropdown shipped, when
 *  the field was a free 1-90 number input) can carry a value outside the
 *  preset list — without this, `<select value={form.value}>` would silently
 *  show no option selected instead of the real stored percentage, and an
 *  unnoticed submit would blow away that value the moment ANY option gets
 *  picked. */
function discountOptionsFor(currentValue: number): number[] {
  if (DISCOUNT_PRESETS.includes(currentValue)) return DISCOUNT_PRESETS;
  return [...DISCOUNT_PRESETS, currentValue].sort((a, b) => a - b);
}

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
 * Mirrors Etsy's 2-screen flow: an explainer with a live preview, then the
 * actual discount form.
 */
export function OrderMinimumModal({ promotion, onClose, onSave }: OrderMinimumModalProps) {
  const isEdit = !!promotion?.id;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<OrderMinimumFormData>(() =>
    isEdit ? {
      description:     promotion.description ?? '',
      value:            promotion.value,
      minOrderAmount:   promotion.minOrderAmount ?? 0,
      country:          promotion.country ?? '',
      startsAt:         localDateInputValue(promotion.startsAt),
      expiresAt:        localDateInputValue(promotion.expiresAt),
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

  if (step === 1) {
    return (
      <Modal isOpen onClose={onClose} size="lg">
        <div className="px-6 py-6">
          <h2 className="font-display text-xl font-bold text-secondary">Here&apos;s how discounts with order minimums work</h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            You choose the discount and the minimum shoppers have to buy to get it — this can be a number of items or how much they spend.
            For now, this type of sale applies to your whole shop, so you can&apos;t choose specific listings.
          </p>
          <p className="text-sm font-semibold text-secondary mt-4">We&apos;ll show buyers something like this:</p>

          <div className="mt-3 mx-auto max-w-[280px] bg-surface border border-border rounded-card shadow-card p-3">
            <div className="aspect-square rounded bg-muted/10" />
            <p className="text-sm font-bold text-secondary mt-2">
              {form.minOrderAmount > 0 ? `$${form.minOrderAmount}+ order` : 'Your item'}
            </p>
            <p className="text-xs text-primary font-semibold mt-1">
              Save {form.value || 0}% when you spend ${form.minOrderAmount || 0} at this shop
            </p>
            <p className="text-xs text-secondary underline mt-0.5">Shop the deal</p>
            <button type="button" disabled className="w-full mt-3 py-2 rounded-full bg-secondary/90 text-white text-xs font-semibold">
              Add to basket
            </button>
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => setStep(2)}>Next</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalHeroHeader
        icon={<ShoppingBag className="w-7 h-7" />}
        title={isEdit ? 'Edit discount' : 'Create your discount'}
        subtitle="Set your discount, your order minimum, and how long the offer will run."
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
            <select
              value={form.value}
              onChange={(e) => set('value', Number(e.target.value))}
              className={`${inputCls} ${errors.value ? 'border-red-400' : ''}`}
            >
              {discountOptionsFor(form.value).map((p) => <option key={p} value={p}>{p}% off</option>)}
            </select>
            {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
          </Field>

          <Field label="Order minimum" required>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-3 rounded-button border border-border opacity-50 cursor-not-allowed">
                <input type="radio" disabled className="mt-0.5" />
                <span>
                  <span className="text-sm font-semibold text-secondary block">Number of items</span>
                  <span className="text-xs text-muted">Coming soon</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-button border border-secondary bg-secondary/5">
                <input type="radio" checked readOnly className="mt-0.5" />
                <span className="flex-1">
                  <span className="text-sm font-semibold text-secondary block mb-1.5">Order total</span>
                  <span className="relative block max-w-[160px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                    <input
                      type="number" min={1}
                      value={form.minOrderAmount}
                      onChange={(e) => set('minOrderAmount', Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      className={`${inputCls} pl-6 ${errors.minOrderAmount ? 'border-red-400' : ''}`}
                    />
                  </span>
                </span>
              </label>
            </div>
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

          <Field label="Where valid" hint="You can limit this offer to a specific country">
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              <select
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className={`${inputCls} pl-8 appearance-none`}
              >
                <option value="">Everywhere</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </Field>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep(1)}>Go back</Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>{isEdit ? 'Save discount' : 'Create discount'}</Button>
      </div>
    </Modal>
  );
}
