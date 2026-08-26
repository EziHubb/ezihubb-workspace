'use client';

import { useState, useEffect, useMemo } from 'react';
import { localDateInputValue } from '../../lib/promo-dates';
import { Percent, Globe2, Tag, ArrowLeft } from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';
import { COUNTRIES, countryName, API_ROUTES } from '@ezihubb/constants';
import { ListingPicker, type PickedProduct } from './ListingPicker';
import { api } from '../../lib/api-client';
import { toast } from '../../lib/store/toast.store';
import { fmtDate } from '../../lib/fmt';

export interface SaleFormData {
  description:        string;
  discountType:        'PERCENTAGE' | 'FREE_SHIPPING';
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
  type?:               string;
  value:                number;
  scope:               'SHOP_WIDE' | 'SPECIFIC_LISTINGS';
  productIds?:          string[];
  country?:             string | null;
  startsAt?:            string | null;
  expiresAt?:           string | null;
  termsAndConditions?:  string | null;
}

const EMPTY: SaleFormData = {
  description: '', discountType: 'PERCENTAGE', value: 15, scope: 'SHOP_WIDE', productIds: [],
  country: '', startsAt: '', expiresAt: '', termsAndConditions: '',
};

const DISCOUNT_PRESETS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
const MAX_SALE_DAYS = 30;

// ── Date helpers ─────────────────────────────────────────────────────────────
// Sales can only be scheduled from today onward, and can run for at most 30
// days total — matches Etsy's "Sales can be set to run up to 30 days."

function toISODate(d: Date): string {
  // Local, not d.toISOString().slice(0,10). That gave the UTC date, so a
  // seller east of Greenwich was told "today" was yesterday for the first
  // hours of their own day — and the picker's floor moved with it.
  return localDateInputValue(d.toISOString());
}
function todayISO(): string {
  return toISODate(new Date());
}
function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

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

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step ? 'w-6 bg-secondary' : n < step ? 'w-1.5 bg-secondary/50' : 'w-1.5 bg-secondary/20'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm font-semibold text-secondary shrink-0">{label}</span>
      <span className="text-sm text-muted text-right">{value}</span>
    </div>
  );
}

interface SetUpSaleModalProps {
  sale?:      SalePromotion | null;
  initialProducts?: PickedProduct[];
  onClose:    () => void;
  onSave:     (data: SaleFormData, id?: string) => Promise<void>;
}

const TOTAL_STEPS = 3;

/** Etsy "Set up a sale" — a shop-wide or listing-specific auto-apply discount, no buyer code.
 *  Mirrors Etsy's 3-screen wizard: customise → choose listings → review & confirm. */
export function SetUpSaleModal({ sale, initialProducts = [], onClose, onSave }: SetUpSaleModalProps) {
  const isEdit = !!sale?.id;

  const [form, setForm] = useState<SaleFormData>(() =>
    isEdit ? {
      description:        sale.description ?? '',
      discountType:        sale.type === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : 'PERCENTAGE',
      value:               sale.value,
      scope:               sale.scope,
      productIds:          sale.productIds ?? [],
      country:             sale.country ?? '',
      startsAt:            localDateInputValue(sale.startsAt),
      expiresAt:           localDateInputValue(sale.expiresAt),
      termsAndConditions:  sale.termsAndConditions ?? '',
    } : { ...EMPTY }
  );
  const [discountPreset, setDiscountPreset] = useState<number | 'custom'>(
    () => (DISCOUNT_PRESETS.includes(form.value) ? form.value : 'custom'),
  );
  const [pickedProducts, setPickedProducts] = useState<PickedProduct[]>(initialProducts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const today  = useMemo(() => todayISO(), []);
  const maxEnd = useMemo(() => addDaysISO(today, MAX_SALE_DAYS), [today]);

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

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Sale name is required';
    if (form.discountType === 'PERCENTAGE' && (form.value <= 0 || form.value > 90)) e.value = 'Must be between 1 and 90%';
    if (form.startsAt && form.startsAt < today) e.startsAt = 'Start date can\'t be in the past';
    if (form.expiresAt) {
      const earliestEnd = form.startsAt || today;
      if (form.expiresAt < earliestEnd) e.expiresAt = 'End date must be after the start date';
      else if (form.expiresAt > maxEnd) e.expiresAt = `Sales can run for at most ${MAX_SALE_DAYS} days`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (form.scope === 'SPECIFIC_LISTINGS' && form.productIds.length === 0) {
      e.productIds = 'Select at least one listing';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setErrors({});
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      await onSave(form, sale?.id);
      toast.success(isEdit ? 'Sale updated' : 'Sale created', {
        description: isEdit ? 'Your changes are live.' : `"${form.description}" is now running.`,
      });
    } catch {
      toast.error('Something went wrong', { description: 'Your sale wasn\'t saved — please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const durationLabel = form.startsAt || form.expiresAt
    ? `${form.startsAt ? fmtDate(form.startsAt) : 'Immediately'} – ${form.expiresAt ? fmtDate(form.expiresAt) : 'No end date'}`
    : 'Starts immediately, no end date';

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalHeroHeader
        icon={<Tag className="w-7 h-7" />}
        title={isEdit ? 'Edit sale' : 'Set up a sale'}
        subtitle={
          step === 1
            ? 'Running a sale can help you clear out inventory, attract new customers, and encourage shoppers to spend more.'
            : step === 2
            ? 'Your discount can apply shop-wide, or be limited to specific items.'
            : 'Double-check the details below before your sale goes live.'
        }
        band="periwinkle"
        onClose={onClose}
      />
      <div className="px-6 pt-4 shrink-0">
        <StepIndicator step={step} total={TOTAL_STEPS} />
      </div>

      {/* min-h-0 as well: a flex child defaults to min-height:auto, so
       *  without it this pane will not shrink and the footer below gets
       *  pushed out of the shell, which is overflow-hidden. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ── Step 1: Customise your sale ─────────────────────────────────── */}
        {step === 1 && (
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

            <Field label="Discount amount" required hint="No code required — applied automatically at checkout">
              <div className="flex gap-2">
                <select
                  value={form.discountType}
                  onChange={(e) => set('discountType', e.target.value as SaleFormData['discountType'])}
                  className={`${inputCls} flex-1`}
                >
                  <option value="FREE_SHIPPING">Free standard delivery</option>
                  <option value="PERCENTAGE">Percentage off</option>
                </select>
                {form.discountType === 'PERCENTAGE' && (
                  <select
                    value={discountPreset}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'custom') { setDiscountPreset('custom'); return; }
                      const n = Number(v);
                      setDiscountPreset(n);
                      set('value', n);
                    }}
                    className={`${inputCls} flex-1`}
                  >
                    {DISCOUNT_PRESETS.map((p) => <option key={p} value={p}>{p}% off</option>)}
                    <option value="custom">Custom…</option>
                  </select>
                )}
              </div>
              {form.discountType === 'PERCENTAGE' && discountPreset === 'custom' && (
                <div className="relative mt-2">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    type="number" min={1} max={90}
                    value={form.value}
                    onChange={(e) => set('value', Number(e.target.value))}
                    className={`${inputCls} pl-8 ${errors.value ? 'border-red-400' : ''}`}
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">% off</span>
                </div>
              )}
              {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
            </Field>

            <Field label="Where valid" hint="You can limit your sale to a specific country">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start date" hint="Optional — starts immediately if blank">
                <input
                  type="date"
                  value={form.startsAt}
                  min={today}
                  onChange={(e) => {
                    const v = e.target.value;
                    set('startsAt', v);
                    // Keep the end date inside [start, start+30d] instead of leaving
                    // a now-invalid end date silently sitting behind the new start.
                    if (v && form.expiresAt && form.expiresAt < v) set('expiresAt', v);
                  }}
                  className={`${inputCls} ${errors.startsAt ? 'border-red-400' : ''}`}
                />
                {errors.startsAt && <p className="text-xs text-red-600 mt-1">{errors.startsAt}</p>}
              </Field>
              <Field label="End date" hint={`Sales can run for up to ${MAX_SALE_DAYS} days`}>
                <input
                  type="date"
                  value={form.expiresAt}
                  min={form.startsAt || today}
                  max={maxEnd}
                  onChange={(e) => set('expiresAt', e.target.value)}
                  className={`${inputCls} ${errors.expiresAt ? 'border-red-400' : ''}`}
                />
                {errors.expiresAt && <p className="text-xs text-red-600 mt-1">{errors.expiresAt}</p>}
              </Field>
            </div>

            <Field label="Terms and conditions" hint="Shown to buyers on eligible listings — optional">
              <textarea
                value={form.termsAndConditions}
                onChange={(e) => set('termsAndConditions', e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="e.g. Discount applied automatically at checkout, while supplies last"
                maxLength={500}
              />
              <p className="text-xs text-muted/70 mt-1 text-right">{500 - form.termsAndConditions.length} characters remaining</p>
            </Field>
          </div>
        )}

        {/* ── Step 2: Which listings ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm font-bold text-secondary">Which listings are included in your sale?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => set('scope', 'SHOP_WIDE')}
                className={`text-left p-4 rounded-card border-2 transition-colors ${form.scope === 'SHOP_WIDE' ? 'border-secondary bg-secondary/5' : 'border-border hover:border-secondary/40'}`}>
                <span className="text-sm font-semibold text-secondary block mb-1">All listings</span>
                <span className="text-xs text-muted">This sale is shop-wide, and includes all current and future listings.</span>
              </button>
              <button type="button" onClick={() => set('scope', 'SPECIFIC_LISTINGS')}
                className={`text-left p-4 rounded-card border-2 transition-colors ${form.scope === 'SPECIFIC_LISTINGS' ? 'border-secondary bg-secondary/5' : 'border-border hover:border-secondary/40'}`}>
                <span className="text-sm font-semibold text-secondary block mb-1">Select listings</span>
                <span className="text-xs text-muted">This sale is limited to specific listings.</span>
              </button>
            </div>

            {form.scope === 'SPECIFIC_LISTINGS' && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Choose which listings to include ({pickedProducts.length} selected)
                </p>
                <ListingPicker
                  selected={pickedProducts}
                  onChange={(products) => { setPickedProducts(products); set('productIds', products.map((p) => p.id)); }}
                />
                {errors.productIds && <p className="text-xs text-red-600 mt-1">{errors.productIds}</p>}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Review ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="px-6 py-5">
            <p className="text-sm font-bold text-secondary mb-1">Review your sale details</p>
            <div className="mt-3">
              <ReviewRow label="Discount" value={form.discountType === 'FREE_SHIPPING' ? 'Free standard delivery' : `${form.value}% off`} />
              <ReviewRow label="Where valid" value={countryName(form.country || null)} />
              <ReviewRow label="Duration" value={durationLabel} />
              <ReviewRow
                label="Included listings"
                value={form.scope === 'SHOP_WIDE' ? 'Whole shop' : `${pickedProducts.length} listing${pickedProducts.length === 1 ? '' : 's'}`}
              />
              <ReviewRow label="Sale name" value={form.description} />
              <ReviewRow label="Terms" value={form.termsAndConditions.trim() || 'None'} />
            </div>
            <p className="text-xs text-muted text-center mt-5">
              All discounts are subject to EziHubb&apos;s Advertising &amp; Marketing Policy.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={goBack} disabled={saving}>
              Go back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button variant="primary" onClick={goNext}>
              {step === 1 ? 'Continue' : 'Review and confirm'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFinalSave} loading={saving}>
              {isEdit ? 'Save sale' : 'Confirm and create sale'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
