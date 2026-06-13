'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Save, Loader2, CheckCircle } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Toggle } from '../../../../components/products/edit/primitives/Toggle';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiSettings {
  trendsEnabled:          boolean;
  trendScanIntervalHours: number;
  trendMinScore:          number;

  pricingEnabled:         boolean;
  pricingMaxVariantPct:   number;
  pricingAutoApprove:     boolean;

  creatorDnaEnabled:      boolean;
  creatorDnaAutoRun:      boolean;

  replicateEnabled:       boolean;
  replicateModel:         string;

  monthlyCostLimitUsd:    number;
  dailyCallLimit:         number;
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, description, children }: {
  label:        string;
  description?: string;
  children:     React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-secondary">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-5">
      <h3 className="font-semibold text-secondary text-sm mb-1">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

// ── Number input ──────────────────────────────────────────────────────────────

function NumInput({ value, onChange, min, max, step = 1, unit }: {
  value:    number;
  onChange: (v: number) => void;
  min?:     number;
  max?:     number;
  step?:    number;
  unit?:    string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 text-sm border border-border rounded-button px-2.5 py-1.5 text-right focus:outline-none focus:border-primary transition-colors"
      />
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK = ['ai-settings'];

export default function AiSettingsPage() {
  const { data: remote, isLoading } = useQuery<AiSettings>({
    queryKey: QK,
    queryFn:  () => api.get<AiSettings>(API_ROUTES.ADMIN.AI_SETTINGS),
    staleTime: 60_000,
  });

  const [form, setForm] = useState<AiSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remote && !form) setForm(remote);
  }, [remote, form]);

  const patch = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const save = useMutation({
    mutationFn: () => api.put<AiSettings>(API_ROUTES.ADMIN.AI_SETTINGS, form ?? {}),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  if (isLoading || !form) {
    return (
      <div>
        <AdminPageHeader title="AI Settings" subtitle="Configure AI feature behaviour and usage limits" queryKey={QK} />
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="AI Settings"
        subtitle="Configure AI feature behaviour and usage limits"
        queryKey={QK}
        actions={
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {save.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved
                ? <CheckCircle className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        }
      />

      <Section title="Trend Discovery">
        <FieldRow label="Enable Trend Discovery" description="Automatically scan and suggest trending products based on market signals.">
          <Toggle checked={form.trendsEnabled} onChange={(v) => patch('trendsEnabled', v)} />
        </FieldRow>
        <FieldRow label="Scan Interval" description="How often the AI scans for new trends.">
          <NumInput value={form.trendScanIntervalHours} onChange={(v) => patch('trendScanIntervalHours', v)} min={1} max={168} unit="hours" />
        </FieldRow>
        <FieldRow label="Minimum Score Threshold" description="Trends below this score will not be surfaced for review.">
          <NumInput value={form.trendMinScore} onChange={(v) => patch('trendMinScore', v)} min={0} max={100} unit="/ 100" />
        </FieldRow>
      </Section>

      <Section title="AI Pricing Optimizer">
        <FieldRow label="Enable Pricing Optimizer" description="Run automatic A/B price tests to maximize revenue per product.">
          <Toggle checked={form.pricingEnabled} onChange={(v) => patch('pricingEnabled', v)} />
        </FieldRow>
        <FieldRow label="Max Variant Price Deviation" description="Maximum percentage difference allowed between control and variant price.">
          <NumInput value={form.pricingMaxVariantPct} onChange={(v) => patch('pricingMaxVariantPct', v)} min={1} max={50} unit="%" />
        </FieldRow>
        <FieldRow label="Auto-approve Tests" description="Automatically approve winning variants without manual review.">
          <Toggle checked={form.pricingAutoApprove} onChange={(v) => patch('pricingAutoApprove', v)} />
        </FieldRow>
      </Section>

      <Section title="Creator DNA">
        <FieldRow label="Enable Creator DNA Analysis" description="Analyse creator portfolios to generate style and audience profiles.">
          <Toggle checked={form.creatorDnaEnabled} onChange={(v) => patch('creatorDnaEnabled', v)} />
        </FieldRow>
        <FieldRow label="Auto-run on New Uploads" description="Automatically trigger DNA analysis when a creator adds new products.">
          <Toggle checked={form.creatorDnaAutoRun} onChange={(v) => patch('creatorDnaAutoRun', v)} />
        </FieldRow>
      </Section>

      <Section title="Image Generation (Replicate)">
        <FieldRow label="Enable Replicate Integration" description="Use Replicate models for AI art style generation in the product customizer.">
          <Toggle checked={form.replicateEnabled} onChange={(v) => patch('replicateEnabled', v)} />
        </FieldRow>
        <FieldRow label="Model ID" description="The Replicate model to use for image-to-image generation.">
          <input
            type="text"
            value={form.replicateModel}
            onChange={(e) => patch('replicateModel', e.target.value)}
            placeholder="owner/model-name:version"
            className="w-64 text-sm border border-border rounded-button px-3 py-1.5 focus:outline-none focus:border-primary transition-colors font-mono"
          />
        </FieldRow>
      </Section>

      <Section title="Usage & Cost Limits">
        <FieldRow label="Monthly Cost Limit" description="Automatically pause AI features if this USD threshold is exceeded.">
          <NumInput value={form.monthlyCostLimitUsd} onChange={(v) => patch('monthlyCostLimitUsd', v)} min={0} step={10} unit="USD / month" />
        </FieldRow>
        <FieldRow label="Daily API Call Limit" description="Hard cap on total AI API calls per day across all features.">
          <NumInput value={form.dailyCallLimit} onChange={(v) => patch('dailyCallLimit', v)} min={0} step={100} unit="calls / day" />
        </FieldRow>
      </Section>
    </div>
  );
}
