'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Toggle as PrimitiveToggle } from '../../../../components/products/edit/primitives/Toggle';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformSettings {
  id:                       string;
  defaultCommissionRate:    number;
  minPayoutAmount:          number;
  payoutSchedule:           string;
  allowPublicRegistration:  boolean;
  maintenanceMode:          boolean;
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

export default function PlatformSettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey:  ['admin-platform-settings'],
    queryFn:   () => api.get<PlatformSettings>(API_ROUTES.ADMIN.PLATFORM_SETTINGS),
    staleTime: 60_000,
  });

  const [form,   setForm  ] = useState<Omit<PlatformSettings, 'id'> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        defaultCommissionRate:   data.defaultCommissionRate,
        minPayoutAmount:         data.minPayoutAmount,
        payoutSchedule:          data.payoutSchedule ?? 'WEEKLY',
        allowPublicRegistration: data.allowPublicRegistration,
        maintenanceMode:         data.maintenanceMode,
      });
    }
  }, [data, form]);

  const s: Omit<PlatformSettings, 'id'> = form ?? {
    defaultCommissionRate:   0.1,
    minPayoutAmount:         50,
    payoutSchedule:          'WEEKLY',
    allowPublicRegistration: true,
    maintenanceMode:         false,
  };

  const setS = (patch: Partial<typeof s>) => setForm((f) => ({ ...(f ?? s), ...patch }));

  const save = async (section: string) => {
    setSaving(section);
    try {
      await api.patch(API_ROUTES.ADMIN.PLATFORM_SETTINGS, s);
      qc.invalidateQueries({ queryKey: ['admin-platform-settings'] });
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
        subtitle="Configure global commission rates, payouts, and marketplace behaviour"
        queryKey={['admin-platform-settings']}
      />

      <div className="space-y-4 max-w-2xl">

        {/* Commission & Payouts */}
        <SectionCard
          title="💰 Commission & Payouts"
          onSave={() => save('commission')}
          saving={saving === 'commission'}
        >
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Default Commission Rate
            </label>
            <div className="relative">
              <input
                type="number"
                min={0.01}
                max={0.5}
                step={0.01}
                value={s.defaultCommissionRate}
                onChange={(e) => setS({ defaultCommissionRate: Number(e.target.value) })}
                className={`${inputCls} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                {(Number(s.defaultCommissionRate) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted/70 mt-1">Applied to stores not on a specific plan (0.01–0.50).</p>
          </div>

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
