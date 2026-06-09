'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { clientFetch } from '../../../../lib/api';
import { Toggle as PrimitiveToggle } from '../../../../components/products/edit/primitives';

// ── Shared primitives ──────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function Toggle({
  checked, onChange, label, sub,
}: {
  checked:  boolean;
  onChange: (v: boolean) => void;
  label:    string;
  sub?:     string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <div className="mt-0.5 shrink-0">
        <PrimitiveToggle checked={checked} onChange={onChange} ariaLabel={label} />
      </div>
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </label>
  );
}

// ── Settings type ──────────────────────────────────────────────────────────────

interface AffiliateSettings {
  id:               string;
  isEnabled:        boolean;
  defaultRate:      number;
  buyerDiscountRate: number;
  cookieDays:       number;
  minPayoutAmount:  number;
  lockDays:         number;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AffiliateSettingsPage() {
  const qc = useQueryClient();

  const [isEnabled,        setIsEnabled]        = useState(true);
  const [defaultRate,      setDefaultRate]      = useState('10');
  const [buyerDiscountRate, setBuyerDiscountRate] = useState('5');
  const [cookieDays,       setCookieDays]       = useState('30');
  const [minPayoutAmount,  setMinPayoutAmount]  = useState('50');
  const [lockDays,         setLockDays]         = useState('14');

  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);
  const [error,  setError]  = useState('');

  const { data, isLoading } = useQuery<AffiliateSettings>({
    queryKey: ['admin-affiliate-settings'],
    queryFn:  async () => {
      const res  = await clientFetch('/admin/affiliates/settings');
      const body = await res.json();
      return (body.data ?? body) as AffiliateSettings;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setIsEnabled(data.isEnabled);
    setDefaultRate(String((Number(data.defaultRate) * 100).toFixed(1)));
    setBuyerDiscountRate(String((Number(data.buyerDiscountRate) * 100).toFixed(1)));
    setCookieDays(String(data.cookieDays));
    setMinPayoutAmount(String(Number(data.minPayoutAmount).toFixed(2)));
    setLockDays(String(data.lockDays));
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await clientFetch('/admin/affiliates/settings', {
        method: 'PATCH',
        body:   JSON.stringify({
          isEnabled,
          defaultRate:       Number(defaultRate) / 100,
          buyerDiscountRate: Number(buyerDiscountRate) / 100,
          cookieDays:        Number(cookieDays),
          minPayoutAmount:   Number(minPayoutAmount),
          lockDays:          Number(lockDays),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error((j as { error?: { message?: string } })?.error?.message ?? 'Save failed');
      }
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      void qc.invalidateQueries({ queryKey: ['admin-affiliate-settings'] });
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  const skeleton = (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-40 bg-surface border border-border rounded-card animate-pulse" />
      ))}
    </div>
  );

  if (isLoading) return (
    <>
      <AdminPageHeader title="Affiliate Settings" subtitle="Configure the affiliate program" />
      {skeleton}
    </>
  );

  return (
    <>
      <AdminPageHeader
        title="Affiliate Settings"
        subtitle="Configure commission rates, cookie duration, and payout rules"
      />

      <div className="max-w-[640px] space-y-6">

        {/* Program toggle */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6">
          <h4 className="font-semibold text-secondary mb-4">Program Status</h4>
          <Toggle
            checked={isEnabled}
            onChange={setIsEnabled}
            label="Enable affiliate program"
            sub="When disabled, referral tracking is paused and new applications are hidden from the storefront."
          />
        </div>

        {/* Commission rates */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
          <h4 className="font-semibold text-secondary">Commission Rates</h4>

          <div>
            <FieldLabel>Default affiliate commission rate</FieldLabel>
            <div className="relative w-40">
              <input
                type="number"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                min={0}
                max={100}
                step={0.1}
                className={`${inputCls} pr-7`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Applied when an affiliate has no individual commission rate override.
            </p>
          </div>

          <div>
            <FieldLabel>Buyer referral discount rate</FieldLabel>
            <div className="relative w-40">
              <input
                type="number"
                value={buyerDiscountRate}
                onChange={(e) => setBuyerDiscountRate(e.target.value)}
                min={0}
                max={100}
                step={0.1}
                className={`${inputCls} pr-7`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Discount shown to shoppers at checkout when they arrive via a referral link.
              Commission is calculated on <strong>subtotal before</strong> this discount.
            </p>
          </div>
        </div>

        {/* Tracking & payouts */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
          <h4 className="font-semibold text-secondary">Tracking &amp; Payouts</h4>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel>Cookie duration (days)</FieldLabel>
              <input
                type="number"
                value={cookieDays}
                onChange={(e) => setCookieDays(e.target.value)}
                min={1}
                max={365}
                step={1}
                className={inputCls}
              />
              <p className="text-xs text-muted mt-1">How long the referral cookie is valid.</p>
            </div>

            <div>
              <FieldLabel>Commission lock period (days)</FieldLabel>
              <input
                type="number"
                value={lockDays}
                onChange={(e) => setLockDays(e.target.value)}
                min={1}
                max={365}
                step={1}
                className={inputCls}
              />
              <p className="text-xs text-muted mt-1">Days after DELIVERED before commission is auto-confirmed.</p>
            </div>

            <div>
              <FieldLabel>Minimum payout amount ($)</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  type="number"
                  value={minPayoutAmount}
                  onChange={(e) => setMinPayoutAmount(e.target.value)}
                  min={0}
                  step={1}
                  className={`${inputCls} pl-7`}
                />
              </div>
              <p className="text-xs text-muted mt-1">Affiliates can&apos;t request a payout below this amount.</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-button transition-colors disabled:opacity-50 ${done ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : done ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </>
  );
}
