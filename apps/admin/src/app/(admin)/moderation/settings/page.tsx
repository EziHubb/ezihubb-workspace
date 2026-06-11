'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings2, Save } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

interface ModSettings {
  isEnabled:           boolean;
  moderateProductText: boolean;
  moderateStoreText:   boolean;
  moderateReviews:     boolean;
  moderateMessages:    boolean;
  moderateImages:      boolean;
  autoCriticalBlock:   boolean;
  autoHighFlag:        boolean;
  autoMediumFlag:      boolean;
  autoLowWarn:         boolean;
  cacheCleanResultDays: number;
  strikeEnabled:       boolean;
  strikeLimitHigh:     number;
  strikeLimitCritical: number;
  strikeWindowDays:    number;
  maxDailyApiCalls:    number;
  maxCostPerDayUsd:    number | string;
}

function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ml-4 ${value ? 'bg-primary' : 'bg-muted/30'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberInput({ value, onChange, label, min, max }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <p className="text-sm font-medium text-secondary">{label}</p>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max}
        className="w-24 text-sm border border-border rounded-button px-3 py-1.5 text-right focus:outline-none focus:border-primary tabular-nums" />
    </div>
  );
}

export default function ModerationSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ModSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery<ModSettings>({
    queryKey: ['admin-mod-settings'],
    queryFn:  () => api.get<ModSettings>(API_ROUTES.ADMIN.MODERATION_SETTINGS),
  });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const mutation = useMutation({
    mutationFn: (settings: ModSettings) => api.patch(API_ROUTES.ADMIN.MODERATION_SETTINGS, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-mod-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!form) return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-muted/10 rounded-card animate-pulse" />)}
    </div>
  );

  const set = <K extends keyof ModSettings>(k: K, v: ModSettings[K]) =>
    setForm((f) => f ? ({ ...f, [k]: v }) : f);

  return (
    <>
      <AdminPageHeader
        title="Moderation Settings"
        subtitle="Configure AI content moderation behavior and thresholds"
        queryKey={['admin-mod-settings']}
      />

      <div className="max-w-2xl space-y-6">
        {/* Global */}
        <section className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-2">Global</h3>
          <Toggle value={form.isEnabled} onChange={(v) => set('isEnabled', v)} label="Content moderation enabled" description="Master switch — disabling skips all moderation" />
        </section>

        {/* Content types */}
        <section className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-2">Check these content types</h3>
          <Toggle value={form.moderateProductText} onChange={(v) => set('moderateProductText', v)} label="Product text (name, description)" />
          <Toggle value={form.moderateStoreText}   onChange={(v) => set('moderateStoreText',   v)} label="Store text (name, description)" />
          <Toggle value={form.moderateReviews}     onChange={(v) => set('moderateReviews',     v)} label="Reviews" />
          <Toggle value={form.moderateMessages}    onChange={(v) => set('moderateMessages',    v)} label="Messages" />
          <Toggle value={form.moderateImages}      onChange={(v) => set('moderateImages',      v)} label="Images (product & store)" />
        </section>

        {/* Auto-actions */}
        <section className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-2">Auto-actions</h3>
          <Toggle value={form.autoCriticalBlock} onChange={(v) => set('autoCriticalBlock', v)} label="Critical violations → auto-hide"  description="CRITICAL content hidden immediately without admin review" />
          <Toggle value={form.autoHighFlag}      onChange={(v) => set('autoHighFlag',      v)} label="High violations → auto-flag"    description="HIGH content flagged and hidden, admin review required" />
          <Toggle value={form.autoMediumFlag}    onChange={(v) => set('autoMediumFlag',    v)} label="Medium violations → auto-flag"  description="MEDIUM content flagged and hidden" />
          <Toggle value={form.autoLowWarn}       onChange={(v) => set('autoLowWarn',       v)} label="Low violations → warn seller"   description="LOW content stays visible, seller gets a soft warning" />
        </section>

        {/* Strike system */}
        <section className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-2">Strike system</h3>
          <Toggle value={form.strikeEnabled} onChange={(v) => set('strikeEnabled', v)} label="Strike system enabled" />
          <NumberInput value={form.strikeLimitHigh}     onChange={(v) => set('strikeLimitHigh',     v)} label="HIGH violations before warning" min={1} max={20} />
          <NumberInput value={form.strikeLimitCritical} onChange={(v) => set('strikeLimitCritical', v)} label="CRITICAL violations before suspend" min={1} max={5} />
          <NumberInput value={form.strikeWindowDays}    onChange={(v) => set('strikeWindowDays',    v)} label="Rolling window (days)" min={7} max={365} />
        </section>

        {/* Cost controls */}
        <section className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-2">Cost controls</h3>
          <NumberInput value={form.maxDailyApiCalls} onChange={(v) => set('maxDailyApiCalls', v)} label="Max API calls/day" min={100} />
          <NumberInput value={Number(form.maxCostPerDayUsd)} onChange={(v) => set('maxCostPerDayUsd', v)} label="Max cost/day (USD)" min={1} />
          <NumberInput value={form.cacheCleanResultDays} onChange={(v) => set('cacheCleanResultDays', v)} label="Cache clean results for (days)" min={1} max={90} />
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-button hover:bg-primary/90 disabled:opacity-60 transition-colors">
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
          {mutation.isError && <p className="text-sm text-red-600">Failed to save. Please try again.</p>}
        </div>
      </div>
    </>
  );
}
