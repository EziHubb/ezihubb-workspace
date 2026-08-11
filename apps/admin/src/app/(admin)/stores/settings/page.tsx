'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Toggle as PrimitiveToggle } from '../../../../components/products/edit/primitives/Toggle';
import { useDialog } from '../../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformSettings {
  id:                         string;
  transactionFeeRate:         number;
  paymentProcessingFeeRate:   number;
  paymentProcessingFixedFee:  number;
  listingFee:                 number;
  regulatoryFeeRate:          number;
  regulatoryFeeCountries:     string[];
  minPayoutAmount:            number;
  payoutSchedule:             string;
  allowPublicRegistration:    boolean;
  maintenanceMode:            boolean;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  onSave,
  saving,
}: {
  title:    string;
  children: React.ReactNode;
  onSave:   () => void;
  saving?:  boolean;
}) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
      <h4 className="font-semibold text-secondary">{title}</h4>
      {children}
      <div className="pt-1 border-t border-border">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="mt-0.5 shrink-0">
        <PrimitiveToggle checked={checked} onChange={onChange} ariaLabel={label} />
      </div>
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULTS: Omit<PlatformSettings, 'id'> = {
  transactionFeeRate:        0.065,
  paymentProcessingFeeRate:  0.05,
  paymentProcessingFixedFee: 0.25,
  listingFee:                0.20,
  regulatoryFeeRate:         0.0124,
  regulatoryFeeCountries:    [],
  minPayoutAmount:           50,
  payoutSchedule:            'WEEKLY',
  allowPublicRegistration:   true,
  maintenanceMode:           false,
};

export default function PlatformSettingsPage() {
  const qc = useQueryClient();
  const { alert } = useDialog();

  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey:  ['admin-platform-settings'],
    queryFn:   () => api.get<PlatformSettings>(API_ROUTES.ADMIN.PLATFORM_SETTINGS),
    staleTime: 60_000,
  });

  const [form,   setForm  ] = useState<Omit<PlatformSettings, 'id'> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [countriesInput, setCountriesInput] = useState('');

  useEffect(() => {
    if (data && !form) {
      setForm({
        transactionFeeRate:        data.transactionFeeRate,
        paymentProcessingFeeRate:  data.paymentProcessingFeeRate,
        paymentProcessingFixedFee: data.paymentProcessingFixedFee,
        listingFee:                data.listingFee,
        regulatoryFeeRate:         data.regulatoryFeeRate,
        regulatoryFeeCountries:    data.regulatoryFeeCountries ?? [],
        minPayoutAmount:           data.minPayoutAmount,
        payoutSchedule:            data.payoutSchedule ?? 'WEEKLY',
        allowPublicRegistration:   data.allowPublicRegistration,
        maintenanceMode:           data.maintenanceMode,
      });
      setCountriesInput((data.regulatoryFeeCountries ?? []).join(', '));
    }
  }, [data, form]);

  const s: Omit<PlatformSettings, 'id'> = form ?? DEFAULTS;

  const setS = (patch: Partial<typeof s>) => setForm((f) => ({ ...(f ?? s), ...patch }));

  const save = async (section: string) => {
    setSaving(section);
    try {
      await api.patch(API_ROUTES.ADMIN.PLATFORM_SETTINGS, s);
      qc.invalidateQueries({ queryKey: ['admin-platform-settings'] });
    } catch (err) {
      await alert((err as Error).message || 'Could not save platform settings.', { variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

  if (isLoading) {
    return (
      <>
        <AdminPageHeader title="Platform Settings" subtitle="Configure global marketplace settings" queryKey={['admin-platform-settings']} />
        <div className="space-y-4 max-w-2xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-surface border border-border rounded-card animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Platform Settings"
        subtitle="Configure seller fees, payouts, and marketplace behaviour"
        queryKey={['admin-platform-settings']}
      />

      <div className="space-y-4 max-w-2xl">

        {/* Seller Fees */}
        <SectionCard
          title="💰 Seller Fees (Etsy-style — same for every seller)"
          onSave={() => save('fees')}
          saving={saving === 'fees'}
        >
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Transaction Fee
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={0.5}
                step={0.001}
                value={s.transactionFeeRate}
                onChange={(e) => setS({ transactionFeeRate: Number(e.target.value) })}
                className={`${inputCls} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                {(Number(s.transactionFeeRate) * 100).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-muted/70 mt-1">Charged on every sale (subtotal + shipping).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Payment Processing Fee
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  max={0.5}
                  step={0.001}
                  value={s.paymentProcessingFeeRate}
                  onChange={(e) => setS({ paymentProcessingFeeRate: Number(e.target.value) })}
                  className={`${inputCls} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                  {(Number(s.paymentProcessingFeeRate) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={s.paymentProcessingFixedFee}
                  onChange={(e) => setS({ paymentProcessingFixedFee: Number(e.target.value) })}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
            <p className="text-xs text-muted/70 mt-1">Percentage + fixed fee, charged on every sale.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Listing Fee
            </label>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={s.listingFee}
                onChange={(e) => setS({ listingFee: Number(e.target.value) })}
                className={`${inputCls} pl-7`}
              />
            </div>
            <p className="text-xs text-muted/70 mt-1">Charged once when a seller creates a new product listing.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Regulatory Operating Fee
            </label>
            <div className="relative w-40 mb-2">
              <input
                type="number"
                min={0}
                max={0.5}
                step={0.001}
                value={s.regulatoryFeeRate}
                onChange={(e) => setS({ regulatoryFeeRate: Number(e.target.value) })}
                className={`${inputCls} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                {(Number(s.regulatoryFeeRate) * 100).toFixed(2)}%
              </span>
            </div>
            <input
              type="text"
              value={countriesInput}
              onChange={(e) => {
                setCountriesInput(e.target.value);
                setS({ regulatoryFeeCountries: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) });
              }}
              placeholder="e.g. FR, IT, TR, VN"
              className={inputCls}
            />
            <p className="text-xs text-muted/70 mt-1">
              Comma-separated ISO country codes where this fee applies (based on the store's country). Leave empty to disable.
            </p>
          </div>
        </SectionCard>

        {/* Payouts */}
        <SectionCard
          title="🏦 Payouts"
          onSave={() => save('payouts')}
          saving={saving === 'payouts'}
        >
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Minimum Payout Amount ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                type="number"
                min={0}
                step={1}
                value={s.minPayoutAmount}
                onChange={(e) => setS({ minPayoutAmount: Number(e.target.value) })}
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Payout Schedule
            </label>
            <select
              value={s.payoutSchedule}
              onChange={(e) => setS({ payoutSchedule: e.target.value })}
              className={inputCls}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </SectionCard>

        {/* Access & Registration */}
        <SectionCard
          title="🔐 Access & Registration"
          onSave={() => save('access')}
          saving={saving === 'access'}
        >
          <Toggle
            checked={s.allowPublicRegistration}
            onChange={(v) => setS({ allowPublicRegistration: v })}
            label="Allow public seller registration"
            description="When disabled, only invited users can apply for a store."
          />
        </SectionCard>

        {/* Maintenance */}
        <SectionCard
          title="🛠 Maintenance"
          onSave={() => save('maintenance')}
          saving={saving === 'maintenance'}
        >
          <Toggle
            checked={s.maintenanceMode}
            onChange={(v) => setS({ maintenanceMode: v })}
            label="Enable maintenance mode"
            description="Takes the marketplace offline for buyers. Admin panel remains accessible."
          />
          {s.maintenanceMode && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-button">
              <p className="text-xs font-semibold text-amber-700">
                Warning: maintenance mode is active. Buyers cannot access the store.
              </p>
            </div>
          )}
        </SectionCard>

      </div>
    </>
  );
}
