'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShippingMethodFormData {
  name:             string;
  carrier:          string;
  minDays:          number;
  maxDays:          number;
  price:            number;
  freeShippingOver: number | null;
  isActive:         boolean;
}

export interface ShippingMethod extends ShippingMethodFormData {
  id:     string;
  zoneId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARRIERS = ['USPS', 'FedEx', 'UPS', 'DHL', 'Other'] as const;

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ShippingMethodModalProps {
  zoneName:  string;
  zoneId:    string;
  method?:   ShippingMethod | null;
  onClose:   () => void;
  onSave:    (data: ShippingMethodFormData, zoneId: string, methodId?: string) => Promise<void>;
}

export function ShippingMethodModal({
  zoneName,
  zoneId,
  method,
  onClose,
  onSave,
}: ShippingMethodModalProps) {
  const isEdit = !!method?.id;

  const [form,   setForm]   = useState<ShippingMethodFormData>(() => ({
    name:             method?.name             ?? '',
    carrier:          method?.carrier          ?? 'USPS',
    minDays:          method?.minDays          ?? 3,
    maxDays:          method?.maxDays          ?? 7,
    price:            method?.price            ?? 0,
    freeShippingOver: method?.freeShippingOver ?? null,
    isActive:         method?.isActive         ?? true,
  }));
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = <K extends keyof ShippingMethodFormData>(k: K, v: ShippingMethodFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())         e.name    = 'Method name is required';
    if (form.minDays < 1)          e.minDays = 'Min days must be ≥ 1';
    if (form.maxDays < form.minDays) e.maxDays = 'Max days must be ≥ min days';
    if (form.price < 0)            e.price   = 'Price cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form, zoneId, method?.id);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-bold text-secondary">{isEdit ? 'Edit Shipping Method' : 'New Shipping Method'}</h3>
            <p className="text-xs text-muted mt-0.5">Zone: <span className="font-medium text-secondary">{zoneName}</span></p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Method name */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Method Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              placeholder="e.g. Standard Shipping (5-10 days)"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Carrier */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Carrier</label>
            <select
              value={form.carrier}
              onChange={(e) => set('carrier', e.target.value)}
              className={inputCls}
            >
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Min / Max days */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Min Days <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={form.minDays}
                onChange={(e) => set('minDays', Math.max(1, Number(e.target.value)))}
                className={`${inputCls} ${errors.minDays ? 'border-red-400' : ''}`}
              />
              {errors.minDays && <p className="text-xs text-red-600 mt-1">{errors.minDays}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Max Days <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={form.maxDays}
                onChange={(e) => set('maxDays', Math.max(1, Number(e.target.value)))}
                className={`${inputCls} ${errors.maxDays ? 'border-red-400' : ''}`}
              />
              {errors.maxDays && <p className="text-xs text-red-600 mt-1">{errors.maxDays}</p>}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Shipping Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => set('price', Number(e.target.value))}
                className={`${inputCls} pl-7 ${errors.price ? 'border-red-400' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
          </div>

          {/* Free shipping over */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Free if order over $ <span className="text-muted font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.freeShippingOver ?? ''}
                onChange={(e) => set('freeShippingOver', e.target.value ? Number(e.target.value) : null)}
                className={`${inputCls} pl-7`}
                placeholder="Leave blank to disable"
              />
            </div>
            <p className="text-xs text-muted/70 mt-1">Free shipping applies after discounts are deducted.</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-secondary">{form.isActive ? 'Active — visible to customers' : 'Inactive — hidden'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : (isEdit ? 'Save Method' : 'Add Method')}
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
