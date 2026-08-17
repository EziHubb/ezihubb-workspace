'use client';

import { useState, useEffect } from 'react';
import { Tag, Zap, Percent, DollarSign, Truck, Globe2 } from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';
import { StorePicker, type StoreOption } from '../ui/StorePicker';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export interface PromotionFormData {
  code:             string;
  type:             DiscountType;
  value:            number;
  minOrderAmount:   number | null;
  maxUses:          number | null;
  maxUsesPerUser:   number;
  startsAt:         string;
  expiresAt:        string;
  neverExpires:     boolean;
  description:      string;
}

export interface Promotion extends Omit<PromotionFormData, 'code'> {
  id:           string;
  /** Null for an autoApply sale (Etsy "Set up a sale") — a buyer-code coupon always has one. */
  code:         string | null;
  currentUses:  number;
  isActive:     boolean;
  createdAt:    string;
  /** Null = a platform-wide coupon, valid across every store. */
  store?:       StoreOption | null;
  autoApply:    boolean;
  scope:        'SHOP_WIDE' | 'SPECIFIC_LISTINGS';
  country?:     string | null;
  termsAndConditions?: string | null;
  productIds?:  string[];
}

const EMPTY_FORM: PromotionFormData = {
  code:           '',
  type:           'PERCENTAGE',
  value:          10,
  minOrderAmount: null,
  maxUses:        null,
  maxUsesPerUser: 1,
  startsAt:       '',
  expiresAt:      '',
  neverExpires:   true,
  description:    '',
};

// ── Random code generator ────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Discount type radio card ─────────────────────────────────────────────────

function TypeCard({
  label, icon: Icon, selected, onClick,
}: {
  value:    DiscountType;
  label:    string;
  icon:     React.ElementType;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-2 px-4 py-3 rounded-card border-2 text-sm font-semibold transition-all flex-1',
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted hover:border-primary/40 hover:text-secondary',
      ].join(' ')}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

// ── Field wrapper ────────────────────────────────────────────────────────────

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

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

// ── Modal ─────────────────────────────────────────────────────────────────────

interface PromotionModalProps {
  promotion?: Promotion | null;
  /** True for a SUPER_ADMIN viewing "Platform" (no store switched into) — offers the store-target picker on create. */
  isPlatformContext?: boolean;
  onClose:    () => void;
  onSave:     (data: PromotionFormData, id?: string, storeId?: string) => Promise<void>;
}

export function PromotionModal({ promotion, isPlatformContext, onClose, onSave }: PromotionModalProps) {
  const isEdit = !!promotion?.id;

  const [form,    setForm]    = useState<PromotionFormData>(() =>
    isEdit ? {
      code:           promotion.code ?? '',
      type:           promotion.type,
      value:          promotion.value,
      minOrderAmount: promotion.minOrderAmount,
      maxUses:        promotion.maxUses,
      maxUsesPerUser: promotion.maxUsesPerUser,
      startsAt:       promotion.startsAt ? promotion.startsAt.slice(0, 10) : '',
      expiresAt:      promotion.expiresAt ? promotion.expiresAt.slice(0, 10) : '',
      neverExpires:   !promotion.expiresAt,
      description:    promotion.description ?? '',
    } : { ...EMPTY_FORM }
  );

  // Only meaningful on create for a platform-context SUPER_ADMIN — left unset,
  // the coupon is platform-wide (valid across every store), matching the
  // long-standing default. Picking a store scopes it to just that store.
  // Not offered on edit — a coupon's store isn't reassignable after creation.
  const [storeTarget, setStoreTarget] = useState<StoreOption | null>(null);

  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = <K extends keyof PromotionFormData>(k: K, v: PromotionFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.code.trim())                          e.code  = 'Code is required';
    if (form.type !== 'FREE_SHIPPING') {
      if (form.value <= 0)                          e.value = 'Value must be > 0';
      if (form.type === 'PERCENTAGE' && form.value > 100) e.value = 'Max 100%';
    }
    if (!form.neverExpires && form.expiresAt && form.startsAt) {
      if (new Date(form.startsAt) >= new Date(form.expiresAt))
        e.expiresAt = 'Expiry must be after start date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: PromotionFormData = {
        ...form,
        code:      form.code.trim().toUpperCase(),
        expiresAt: form.neverExpires ? '' : form.expiresAt,
        value:     form.type === 'FREE_SHIPPING' ? 0 : form.value,
      };
      await onSave(payload, promotion?.id, isEdit ? undefined : (storeTarget?.id ?? undefined));
    } catch { /* error handled by parent */ } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeroHeader
        icon={<Tag className="w-7 h-7" />}
        title={isEdit ? `Edit ${promotion.code}` : 'Create a promo code'}
        subtitle="A promo code is an easy way to share a discount with anyone you choose. It can also be a great way to encourage purchases and build loyalty."
        band="periwinkle"
        onClose={onClose}
      />
      <div className="overflow-y-auto">
        {/* Body */}
        <div className="px-6 py-5 space-y-5">

            {/* Code */}
            <Field label="Coupon Code" required>
              <div className="flex gap-2">
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className={`${inputCls} font-mono tracking-widest uppercase flex-1 ${errors.code ? 'border-red-400 focus:ring-red-200' : ''}`}
                  placeholder="e.g. WELCOME10"
                  maxLength={24}
                />
                <button
                  type="button"
                  onClick={() => set('code', generateCode())}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary border border-primary/30 rounded-button hover:bg-primary/5 transition-colors shrink-0 whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generate
                </button>
              </div>
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
            </Field>

            {/* Store scope — platform-context create only */}
            {isPlatformContext && !isEdit && (
              <Field label="Applies to" hint="Leave blank to create a platform-wide coupon, valid across every store">
                <StorePicker value={storeTarget} onChange={setStoreTarget} />
              </Field>
            )}
            {isPlatformContext && isEdit && (
              <div className="flex items-center gap-2 text-xs text-muted bg-background border border-border rounded-button px-3 py-2">
                <Globe2 className="w-3.5 h-3.5 shrink-0" />
                Scope: {promotion?.store ? promotion.store.name : 'Platform-wide (every store)'}
              </div>
            )}

            {/* Discount type */}
            <Field label="Discount Type" required>
              <div className="flex gap-2">
                <TypeCard value="PERCENTAGE"    label="% Percentage"  icon={Percent}    selected={form.type === 'PERCENTAGE'}    onClick={() => set('type', 'PERCENTAGE')}    />
                <TypeCard value="FIXED_AMOUNT"  label="$ Fixed Amount" icon={DollarSign} selected={form.type === 'FIXED_AMOUNT'}  onClick={() => set('type', 'FIXED_AMOUNT')}  />
                <TypeCard value="FREE_SHIPPING" label="Free Shipping" icon={Truck}      selected={form.type === 'FREE_SHIPPING'} onClick={() => set('type', 'FREE_SHIPPING')} />
              </div>
            </Field>

            {/* Conditional value input */}
            {form.type === 'PERCENTAGE' && (
              <Field label="Discount %" required hint="Between 1 and 100">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.value}
                    onChange={(e) => set('value', Number(e.target.value))}
                    className={`${inputCls} pr-8 ${errors.value ? 'border-red-400' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
                </div>
                {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
              </Field>
            )}

            {form.type === 'FIXED_AMOUNT' && (
              <Field label="Discount Amount" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.value}
                    onChange={(e) => set('value', Number(e.target.value))}
                    className={`${inputCls} pl-7 ${errors.value ? 'border-red-400' : ''}`}
                  />
                </div>
                {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
              </Field>
            )}

            {/* Min order + Max uses */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min Order Amount" hint="Leave blank for any order">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.minOrderAmount ?? ''}
                    onChange={(e) => set('minOrderAmount', e.target.value ? Number(e.target.value) : null)}
                    className={`${inputCls} pl-7`}
                    placeholder="No minimum"
                  />
                </div>
              </Field>
              <Field label="Max Total Uses" hint="Leave blank for unlimited">
                <input
                  type="number"
                  min={1}
                  value={form.maxUses ?? ''}
                  onChange={(e) => set('maxUses', e.target.value ? Number(e.target.value) : null)}
                  className={inputCls}
                  placeholder="Unlimited"
                />
              </Field>
            </div>

            {/* Max uses per user + start date */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Uses Per Customer" hint="Default: 1">
                <input
                  type="number"
                  min={1}
                  value={form.maxUsesPerUser}
                  onChange={(e) => set('maxUsesPerUser', Math.max(1, Number(e.target.value)))}
                  className={inputCls}
                />
              </Field>
              <Field label="Start Date" hint="Optional — active immediately if blank">
                <input
                  type="date"
                  value={form.startsAt}
                  onChange={(e) => set('startsAt', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Expiry date */}
            <Field label="Expiry Date">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.neverExpires}
                    onChange={(e) => set('neverExpires', e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  Never expires
                </label>
              </div>
              {!form.neverExpires && (
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set('expiresAt', e.target.value)}
                  className={`${inputCls} ${errors.expiresAt ? 'border-red-400' : ''}`}
                />
              )}
              {errors.expiresAt && <p className="text-xs text-red-600 mt-1">{errors.expiresAt}</p>}
            </Field>

            {/* Internal note */}
            <Field label="Internal Note" hint="Visible to admins only — not shown to customers">
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="e.g. For influencer campaign Q3 2025"
              />
            </Field>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {isEdit ? 'Save code' : 'Continue'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
