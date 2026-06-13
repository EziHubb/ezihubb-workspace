'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Toggle as PrimitiveToggle } from '../../../../components/products/edit/primitives';
import { useDialog } from '../../../../contexts/DialogContext';

// ── Shared primitives ──────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
      <div>
        <h4 className="font-semibold text-secondary">{title}</h4>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
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

function PercentInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <div className="relative w-32">
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder ?? '0'} min={0} max={100} step={0.1} className={`${inputCls} pr-7`} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreatorSettings {
  level1Rate:           number;
  level2Rate:           number;
  level3Rate:           number;
  buyerDiscountRate:    number;
  buyerDiscountEnabled: boolean;
  minPayoutAmount:      number;
  lockDays:             number;
  isEnabled:            boolean;
}

interface Tier {
  id:             string;
  name:           string;
  minReferrals:   number;
  minEarned:      number;
  commissionBonus: number;
  badgeColor:     string;
  badgeIcon:      string;
  sortOrder:      number;
}

// ── Tier modal ─────────────────────────────────────────────────────────────────

const DEFAULT_TIER: Omit<Tier, 'id'> = {
  name: '', minReferrals: 0, minEarned: 0, commissionBonus: 0,
  badgeColor: '#6366F1', badgeIcon: '', sortOrder: 0,
};

function TierModal({ tier, onClose, onSave }: { tier: Tier | null; onClose: () => void; onSave: () => void }) {
  const [form,   setForm]   = useState<Omit<Tier, 'id'>>(tier ?? DEFAULT_TIER);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((s) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (tier) {
        await api.patch(API_ROUTES.ADMIN.ADMIN_CREATORS_TIER(tier.id), form);
      } else {
        await api.post(API_ROUTES.ADMIN.ADMIN_CREATORS_TIERS, form);
      }
      onSave();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[520px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">{tier ? 'Edit Tier' : 'Add Tier'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel required>Tier Name</FieldLabel>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Top Creator" />
          </div>
          <div>
            <FieldLabel>Min Members</FieldLabel>
            <input type="number" min={0} value={form.minReferrals} onChange={(e) => set('minReferrals', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Min Earned ($)</FieldLabel>
            <input type="number" min={0} step={0.01} value={form.minEarned} onChange={(e) => set('minEarned', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Earnings Bonus (%)</FieldLabel>
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1} value={form.commissionBonus} onChange={(e) => set('commissionBonus', Number(e.target.value))} className={`${inputCls} pr-7`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
          </div>
          <div>
            <FieldLabel>Sort Order</FieldLabel>
            <input type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Badge Color</FieldLabel>
            <div className="flex items-center gap-2">
              <input type="color" value={form.badgeColor} onChange={(e) => set('badgeColor', e.target.value)} className="h-9 w-12 border border-border rounded-button cursor-pointer p-0.5" />
              <input value={form.badgeColor} onChange={(e) => set('badgeColor', e.target.value)} className={`${inputCls} font-mono`} placeholder="#6366F1" />
            </div>
          </div>
          <div>
            <FieldLabel>Badge Icon <span className="font-normal text-muted/70">(emoji)</span></FieldLabel>
            <input value={form.badgeIcon} onChange={(e) => set('badgeIcon', e.target.value)} className={inputCls} placeholder="e.g. ⭐" />
          </div>
        </div>
        {form.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Preview:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: form.badgeColor }}>
              {form.badgeIcon && <span>{form.badgeIcon}</span>}
              {form.name}
            </span>
          </div>
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button disabled:opacity-50 transition-colors">
            <Check className="w-4 h-4" />
            {saving ? 'Saving…' : tier ? 'Save Changes' : 'Create Tier'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CreatorSettingsPage() {
  const { confirm } = useDialog();
  const qc = useQueryClient();

  const [s, setS] = useState<CreatorSettings>({
    level1Rate: 10, level2Rate: 5, level3Rate: 1,
    buyerDiscountRate: 5, buyerDiscountEnabled: true,
    minPayoutAmount: 50, lockDays: 14, isEnabled: true,
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const [tierModal,    setTierModal]    = useState<Tier | null | false>(false);
  const [deletingTier, setDeletingTier] = useState<string | null>(null);

  const { data: settingsData } = useQuery<CreatorSettings>({
    queryKey: ['admin-creator-settings'],
    queryFn:  () => api.get<CreatorSettings>(API_ROUTES.ADMIN.ADMIN_CREATORS_SETTINGS),
    staleTime: 60_000,
  });

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<Tier[]>({
    queryKey: ['admin-creator-tiers'],
    queryFn:  () => api.get<Tier[]>(API_ROUTES.ADMIN.ADMIN_CREATORS_TIERS),
    staleTime: 60_000,
  });

  useEffect(() => { if (settingsData) setS(settingsData); }, [settingsData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      await api.patch(API_ROUTES.ADMIN.ADMIN_CREATORS_SETTINGS, s);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveErr((e as Error).message);
    } finally { setSaving(false); }
  };

  const handleTierSaved = () => {
    setTierModal(false);
    void qc.invalidateQueries({ queryKey: ['admin-creator-tiers'] });
  };

  const handleDeleteTier = async (id: string) => {
    if (!await confirm('Delete this tier? Creators assigned to it will have their tier cleared.', { confirmLabel: 'Delete', destructive: true })) return;
    setDeletingTier(id);
    try {
      await api.delete(API_ROUTES.ADMIN.ADMIN_CREATORS_TIER(id));
      void qc.invalidateQueries({ queryKey: ['admin-creator-tiers'] });
    } finally { setDeletingTier(null); }
  };

  const set = <K extends keyof CreatorSettings>(k: K, v: CreatorSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      <AdminPageHeader title="Creator Network Settings" subtitle="Configure earning rates, tiers, and withdrawal rules" queryKey={['admin-creator-settings']} />

      <div className="max-w-[820px] space-y-6">

        <SectionCard title="Earning Rates" subtitle="Percentage of the order total earned at each network level.">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <FieldLabel>Level 1 (direct)</FieldLabel>
              <PercentInput value={s.level1Rate} onChange={(v) => set('level1Rate', v)} placeholder="10" />
              <p className="text-xs text-muted/70 mt-1">The creator who referred the buyer</p>
            </div>
            <div>
              <FieldLabel>Level 2</FieldLabel>
              <PercentInput value={s.level2Rate} onChange={(v) => set('level2Rate', v)} placeholder="5" />
              <p className="text-xs text-muted/70 mt-1">Who introduced Level 1</p>
            </div>
            <div>
              <FieldLabel>Level 3</FieldLabel>
              <PercentInput value={s.level3Rate} onChange={(v) => set('level3Rate', v)} placeholder="1" />
              <p className="text-xs text-muted/70 mt-1">Who introduced Level 2</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Buyer Discount">
          <Toggle checked={s.buyerDiscountEnabled} onChange={(v) => set('buyerDiscountEnabled', v)}
            label="Enable buyer discount on creator link"
            sub="When a customer lands via a creator link and buys, they receive a discount." />
          {s.buyerDiscountEnabled && (
            <div>
              <FieldLabel>Discount Rate for Buyer</FieldLabel>
              <PercentInput value={s.buyerDiscountRate} onChange={(v) => set('buyerDiscountRate', v)} placeholder="5" />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Withdrawal Rules">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <FieldLabel>Minimum Withdrawal ($)</FieldLabel>
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input type="number" min={0} step={0.01} value={s.minPayoutAmount} onChange={(e) => set('minPayoutAmount', Number(e.target.value))} className={`${inputCls} pl-6`} />
              </div>
              <p className="text-xs text-muted/70 mt-1">Creators cannot withdraw below this amount</p>
            </div>
            <div>
              <FieldLabel>Lock Period (days)</FieldLabel>
              <input type="number" min={1} value={s.lockDays} onChange={(e) => set('lockDays', Number(e.target.value))} className={`${inputCls} w-24`} />
              <p className="text-xs text-muted/70 mt-1">Earnings locked before they can be withdrawn</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Programme Status">
          <Toggle checked={s.isEnabled} onChange={(v) => set('isEnabled', v)}
            label="Creator Network enabled"
            sub="When disabled, creator codes stop generating earnings but existing balances are preserved." />
        </SectionCard>

        {saveErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{saveErr}</p>}
        <button type="button" onClick={handleSaveSettings} disabled={saving}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-button transition-colors disabled:opacity-50 ${saved ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}>
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>

        {/* ── Tier Management ── */}
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h4 className="font-semibold text-secondary">Creator Tiers</h4>
              <p className="text-xs text-muted mt-0.5">Creators advance tiers based on their network size and earnings.</p>
            </div>
            <button type="button" onClick={() => setTierModal(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-button transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add Tier
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Badge', 'Name', 'Min Members', 'Min Earned', 'Bonus %', 'Order', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiersLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (<td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>))}</tr>
                    ))
                  : (tiers as Tier[]).length === 0
                    ? (<tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No tiers yet. Click &ldquo;Add Tier&rdquo; to create one.</td></tr>)
                    : (tiers as Tier[]).map((tier) => (
                        <tr key={tier.id} className="hover:bg-muted/3 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: tier.badgeColor }}>
                              {tier.badgeIcon && <span>{tier.badgeIcon}</span>}
                              {tier.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-secondary">{tier.name}</td>
                          <td className="px-4 py-3 text-secondary tabular-nums text-xs">{tier.minReferrals}</td>
                          <td className="px-4 py-3 text-secondary tabular-nums text-xs">${tier.minEarned.toFixed(2)}</td>
                          <td className="px-4 py-3 text-secondary tabular-nums text-xs">{tier.commissionBonus}%</td>
                          <td className="px-4 py-3 text-secondary tabular-nums text-xs">{tier.sortOrder}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => setTierModal(tier)}
                                className="p-1.5 rounded-button border border-border text-muted hover:text-primary hover:border-primary/40 transition-colors" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteTier(tier.id)} disabled={deletingTier === tier.id}
                                className="p-1.5 rounded-button border border-border text-muted hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-40" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {tierModal !== false && (
        <TierModal tier={tierModal} onClose={() => setTierModal(false)} onSave={handleTierSaved} />
      )}
    </>
  );
}
