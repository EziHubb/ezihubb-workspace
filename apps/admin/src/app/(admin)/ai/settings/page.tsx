'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Settings, Save, Loader2, CheckCircle, ChevronDown, ChevronRight,
  Globe, Lock, Eye, EyeOff,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Toggle } from '../../../../components/products/edit/primitives/Toggle';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceSettings {
  enabled: boolean;
  apiKey?: string;
  geo?:    string;
}

interface TrendSourceMeta {
  id:             string;
  name:           string;
  description:    string;
  requiresApiKey: boolean;
  supportsGeo:    boolean;
  geoOptions?:    { value: string; label: string }[];
  keyHint?:       string;
}

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

  trendSources: Record<string, SourceSettings>;
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

// ── Secret input (show/hide toggle) ───────────────────────────────────────────

function SecretInput({ value, onChange, placeholder }: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-64 pr-9 text-sm border border-border rounded-button px-3 py-1.5 focus:outline-none focus:border-primary transition-colors font-mono"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 text-muted hover:text-secondary transition-colors"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({
  meta,
  cfg,
  onPatch,
}: {
  meta:    TrendSourceMeta;
  cfg:     SourceSettings;
  onPatch: (partial: Partial<SourceSettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasKey = !!cfg.apiKey?.trim();

  return (
    <div className={`border rounded-card transition-colors ${cfg.enabled ? 'border-primary/30 bg-primary/[0.02]' : 'border-border bg-surface'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle checked={cfg.enabled} onChange={(v) => onPatch({ enabled: v })} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-secondary">{meta.name}</span>
            {meta.requiresApiKey && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                hasKey ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <Lock className="w-2.5 h-2.5" />
                {hasKey ? 'Key set' : 'Key required'}
              </span>
            )}
            {!meta.requiresApiKey && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <Globe className="w-2.5 h-2.5" /> Free
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5 truncate">{meta.description}</p>
        </div>
        {(meta.requiresApiKey || meta.supportsGeo) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-muted hover:text-secondary transition-colors ml-1"
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expanded config */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {meta.requiresApiKey && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {meta.keyHint ?? 'API Key'}
              </label>
              <SecretInput
                value={cfg.apiKey ?? ''}
                onChange={(v) => onPatch({ apiKey: v })}
                placeholder="Paste your API key…"
              />
            </div>
          )}
          {meta.supportsGeo && meta.geoOptions && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Region / Market</label>
              <select
                value={cfg.geo ?? ''}
                onChange={(e) => onPatch({ geo: e.target.value })}
                className="text-sm border border-border rounded-button px-2.5 py-1.5 focus:outline-none focus:border-primary transition-colors"
              >
                {meta.geoOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK       = ['ai-settings'];
const QK_SRCS  = ['ai-sources'];

export default function AiSettingsPage() {
  const { data: remote, isLoading } = useQuery<AiSettings>({
    queryKey: QK,
    queryFn:  () => api.get<AiSettings>(API_ROUTES.ADMIN.AI_SETTINGS),
    staleTime: 60_000,
  });

  const { data: sourceMeta } = useQuery<TrendSourceMeta[]>({
    queryKey: QK_SRCS,
    queryFn:  () => api.get<TrendSourceMeta[]>(API_ROUTES.ADMIN.AI_SOURCES),
    staleTime: 300_000,
  });

  const [form, setForm] = useState<AiSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remote && !form) setForm(remote);
  }, [remote, form]);

  const patch = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const patchSource = (id: string, partial: Partial<SourceSettings>) =>
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        trendSources: {
          ...f.trendSources,
          [id]: { ...f.trendSources?.[id], ...partial },
        },
      };
    });

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

  const sources: TrendSourceMeta[] = sourceMeta ?? [];

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

      {/* ── Trend Sources ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5 mb-5">
        <h3 className="font-semibold text-secondary text-sm mb-0.5">Trend Sources</h3>
        <p className="text-xs text-muted mb-4">
          Enable the platforms you want to pull trending data from. Free sources work immediately; sources marked
          "Key required" need an API key before they can fetch data.
        </p>

        {sources.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading sources…
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((meta) => (
              <SourceCard
                key={meta.id}
                meta={meta}
                cfg={form.trendSources?.[meta.id] ?? { enabled: false, apiKey: '', geo: '' }}
                onPatch={(partial) => patchSource(meta.id, partial)}
              />
            ))}
          </div>
        )}
      </div>

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
