'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save, Eye, EyeOff, Send, Plus, Pencil,
  X, Code, AlertTriangle, RefreshCw, Download, Shield,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api, adminApi } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { Toggle as PrimitiveToggle } from '../../../components/products/edit/primitives';
import { fmtDate, fmtDateTime, safeStr } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';
import { ADMIN_THEMES, saveTheme, loadSavedTheme, type AdminTheme } from '../../../lib/admin-theme';

// ═══════════════════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════════════════

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
      <h4 className="font-semibold text-secondary">{title}</h4>
      {children}
    </div>
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

function SaveButton({ label = 'Save Changes', saving, onClick }: { label?: string; saving?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
    >
      <Save className="w-3.5 h-3.5" />
      {saving ? 'Saving…' : label}
    </button>
  );
}

// Image upload preview
function ImageUpload({
  label, value, size, onChange,
}: {
  label:    string;
  value?:   string;
  size:     number;
  onChange: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-4">
        <div
          style={{ width: size, height: size }}
          className="rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => ref.current?.click()}
        >
          {value ? (
            <Image src={value} alt={label} width={size} height={size} className="object-cover w-full h-full" />
          ) : (
            <span className="text-muted text-xs text-center px-1">{size}×{size}</span>
          )}
        </div>
        <div>
          <input
            type="file"
            ref={ref}
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Upload image
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="block text-xs text-muted hover:text-red-500 mt-1 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Store Settings
// ═══════════════════════════════════════════════════════════════════════════════

interface StoreSettings {
  name:           string;
  description:    string;
  contactEmail:   string;
  supportPhone:   string;
  logoUrl:        string;
  faviconUrl:     string;
  addressLine1:   string;
  addressLine2:   string;
  city:           string;
  state:          string;
  postalCode:     string;
  country:        string;
  currency:       string;
  taxRate:        number;
  taxIncluded:    boolean;
}

function StoreTab() {
  const [general, setGeneral] = useState<Partial<StoreSettings>>({});
  const [address, setAddress] = useState<Partial<StoreSettings>>({});
  const [tax,     setTax]     = useState<Partial<StoreSettings>>({});
  const [saving,  setSaving]  = useState('');

  const { data, isLoading } = useQuery<StoreSettings>({
    queryKey: ['store-settings'],
    queryFn:  () => api.get<StoreSettings>(API_ROUTES.ADMIN.SETTINGS_STORE),
    staleTime: 60_000,
  });

  // Sync remote state into local on first load
  useEffect(() => {
    if (!data) return;
    setGeneral({
      name: data.name, description: data.description,
      contactEmail: data.contactEmail, supportPhone: data.supportPhone,
      logoUrl: data.logoUrl, faviconUrl: data.faviconUrl,
    });
    setAddress({
      addressLine1: data.addressLine1, addressLine2: data.addressLine2,
      city: data.city, state: data.state, postalCode: data.postalCode, country: data.country,
    });
    setTax({ currency: data.currency, taxRate: data.taxRate, taxIncluded: data.taxIncluded });
  }, [data]);

  const save = async (section: string, payload: Partial<StoreSettings>) => {
    setSaving(section);
    try {
      await api.patch(API_ROUTES.ADMIN.SETTINGS_STORE, payload);
    } finally { setSaving(''); }
  };

  const g = (k: keyof StoreSettings) =>
    (general[k] ?? data?.[k] ?? '') as string;

  const a = (k: keyof StoreSettings) =>
    (address[k] ?? data?.[k] ?? '') as string;

  const t = (k: keyof StoreSettings, fallback: string | number | boolean = '') =>
    (tax[k] ?? data?.[k] ?? fallback);

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 bg-surface border border-border rounded-card animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      {/* General */}
      <SectionCard title="General">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel required>Store Name</FieldLabel>
            <input value={g('name')} onChange={(e) => setGeneral((s) => ({ ...s, name: e.target.value }))}
              className={inputCls} placeholder="DailyDaisy" />
          </div>
          <div className="col-span-2">
            <FieldLabel>Store Description</FieldLabel>
            <textarea value={g('description')} onChange={(e) => setGeneral((s) => ({ ...s, description: e.target.value }))}
              rows={2} className={`${inputCls} resize-none`} placeholder="A brief description of your store…" />
          </div>
          <div>
            <FieldLabel>Contact Email</FieldLabel>
            <input type="email" value={g('contactEmail')} onChange={(e) => setGeneral((s) => ({ ...s, contactEmail: e.target.value }))}
              className={inputCls} placeholder="hello@dailydaisy.com" />
          </div>
          <div>
            <FieldLabel>Support Phone</FieldLabel>
            <input type="tel" value={g('supportPhone')} onChange={(e) => setGeneral((s) => ({ ...s, supportPhone: e.target.value }))}
              className={inputCls} placeholder="+1 (555) 000-0000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ImageUpload label="Store Logo" value={general.logoUrl ?? data?.logoUrl}
            size={80} onChange={(v) => setGeneral((s) => ({ ...s, logoUrl: v }))} />
          <ImageUpload label="Favicon" value={general.faviconUrl ?? data?.faviconUrl}
            size={32} onChange={(v) => setGeneral((s) => ({ ...s, faviconUrl: v }))} />
        </div>
        <SaveButton label="Save General" saving={saving === 'general'} onClick={() => save('general', general)} />
      </SectionCard>

      {/* Address */}
      <SectionCard title="Business Address">
        <p className="text-xs text-muted -mt-3">Used on invoices and legal documents.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FieldLabel>Address Line 1</FieldLabel>
            <input value={a('addressLine1')} onChange={(e) => setAddress((s) => ({ ...s, addressLine1: e.target.value }))}
              className={inputCls} placeholder="123 Daisy Lane" />
          </div>
          <div className="col-span-2">
            <FieldLabel>Address Line 2</FieldLabel>
            <input value={a('addressLine2')} onChange={(e) => setAddress((s) => ({ ...s, addressLine2: e.target.value }))}
              className={inputCls} placeholder="Suite 200 (optional)" />
          </div>
          <div>
            <FieldLabel>City</FieldLabel>
            <input value={a('city')} onChange={(e) => setAddress((s) => ({ ...s, city: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <FieldLabel>State / Province</FieldLabel>
            <input value={a('state')} onChange={(e) => setAddress((s) => ({ ...s, state: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <FieldLabel>Postal Code</FieldLabel>
            <input value={a('postalCode')} onChange={(e) => setAddress((s) => ({ ...s, postalCode: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <FieldLabel>Country</FieldLabel>
            <input value={a('country')} onChange={(e) => setAddress((s) => ({ ...s, country: e.target.value }))}
              className={inputCls} placeholder="United States" />
          </div>
        </div>
        <SaveButton label="Save Address" saving={saving === 'address'} onClick={() => save('address', address)} />
      </SectionCard>

      {/* Currency & Tax */}
      <SectionCard title="Currency & Tax">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Currency</FieldLabel>
            <select value={t('currency', 'USD') as string} onChange={(e) => setTax((s) => ({ ...s, currency: e.target.value }))}
              className={inputCls}>
              <option value="USD">USD — US Dollar</option>
              <option value="VND">VND — Vietnamese Dong</option>
            </select>
          </div>
          <div>
            <FieldLabel>Tax Rate %</FieldLabel>
            <div className="relative">
              <input type="number" min={0} max={100} step={0.01}
                value={t('taxRate', 0) as number}
                onChange={(e) => setTax((s) => ({ ...s, taxRate: Number(e.target.value) }))}
                className={`${inputCls} pr-7`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
          </div>
        </div>
        <Toggle
          checked={t('taxIncluded', false) as boolean}
          onChange={(v) => setTax((s) => ({ ...s, taxIncluded: v }))}
          label="Include tax in displayed prices"
          sub="Prices shown to customers will include tax."
        />
        <SaveButton saving={saving === 'tax'} onClick={() => save('tax', tax)} />
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Email template editor
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  'order-confirmation': ['{{orderNumber}}','{{customerName}}','{{items}}','{{subtotal}}','{{total}}','{{shippingAddress}}','{{storeUrl}}'],
  'order-shipped':      ['{{orderNumber}}','{{trackingNumber}}','{{carrier}}','{{trackingUrl}}','{{estimatedDelivery}}'],
  'order-delivered':    ['{{orderNumber}}','{{deliveredDate}}','{{reviewLink}}'],
  'review-reminder':    ['{{customerName}}','{{productName}}','{{orderNumber}}','{{reviewLink}}'],
  'reset-password':     ['{{firstName}}','{{resetLink}}','{{expiresIn}}'],
  'welcome':            ['{{firstName}}','{{storeUrl}}','{{unsubscribeLink}}'],
  'refund-notification':['{{orderNumber}}','{{refundAmount}}','{{reason}}','{{customerName}}'],
};

function EmailTemplateEditor({
  template,
  onClose,
}: {
  template: { name: string; slug: string; body: string; updatedAt: string };
  onClose:  () => void;
}) {
  const [body,    setBody]    = useState(template.body);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const vars = TEMPLATE_VARIABLES[template.slug] ?? [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.EMAIL_TEMPLATE(template.slug), { body });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  // Simple Handlebars-like preview renderer (replaces known vars with placeholders)
  const previewHtml = body
    .replace(/\{\{orderNumber\}\}/g, 'MLH-00123')
    .replace(/\{\{customerName\}\}/g, 'Sarah Johnson')
    .replace(/\{\{firstName\}\}/g, 'Sarah')
    .replace(/\{\{total\}\}/g, '$55.98')
    .replace(/\{\{subtotal\}\}/g, '$47.98')
    .replace(/\{\{items\}\}/g, '<em>(item list)</em>')
    .replace(/\{\{trackingNumber\}\}/g, '9400111899223456789012')
    .replace(/\{\{carrier\}\}/g, 'USPS')
    .replace(/\{\{trackingUrl\}\}/g, '#')
    .replace(/\{\{resetLink\}\}/g, '#')
    .replace(/\{\{reviewLink\}\}/g, '#')
    .replace(/\{\{storeUrl\}\}/g, 'https://dailydaisy.com')
    .replace(/\{\{refundAmount\}\}/g, '$12.00')
    .replace(/\{\{reason\}\}/g, 'Customer request')
    .replace(/\{\{[\w]+\}\}/g, '<span style="background:#fef3c7;padding:1px 4px;border-radius:3px;font-size:12px">[var]</span>');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[1000px] h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Code className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-secondary">{template.name}</h3>
            <span className="text-xs text-muted">Last edited {fmtDate(template.updatedAt)}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Editor + Preview */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Left: editor */}
          <div className="flex flex-col border-r border-border overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide bg-background border-b border-border">
              Handlebars Template
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 p-4 text-xs font-mono bg-background resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
            {/* Variables */}
            {vars.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-background">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {vars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBody((b) => b + v)}
                      title={`Insert ${v}`}
                      className="text-[11px] font-mono bg-primary/8 text-primary px-2 py-0.5 rounded hover:bg-primary/15 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="flex flex-col overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide bg-background border-b border-border">
              Preview
            </p>
            <div
              className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-button transition-colors disabled:opacity-50 ${success ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : success ? '✓ Saved' : 'Save Template'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Email Settings
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_TEMPLATES = [
  { name: 'Order Confirmation',  slug: 'order-confirmation', body: '<!-- Order confirmation template -->' },
  { name: 'Order Shipped',       slug: 'order-shipped',      body: '<!-- Shipped template -->' },
  { name: 'Order Delivered',     slug: 'order-delivered',    body: '<!-- Delivered template -->' },
  { name: 'Review Reminder',     slug: 'review-reminder',    body: '<!-- Review reminder template -->' },
  { name: 'Password Reset',      slug: 'reset-password',     body: '<!-- Password reset template -->' },
  { name: 'Welcome',             slug: 'welcome',            body: '<!-- Welcome template -->' },
  { name: 'Refund Notification', slug: 'refund-notification',body: '<!-- Refund template -->' },
];

function EmailTab() {
  const { preview } = useDialog();
  const [smtp, setSmtp] = useState({
    host: '', port: '587', user: '', password: '',
    fromName: 'DailyDaisy', fromEmail: '',
  });
  const [showPwd,     setShowPwd]     = useState(false);
  const [smtpSaving,  setSmtpSaving]  = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testDone,    setTestDone]    = useState(false);
  const [editTemplate, setEditTemplate] = useState<typeof EMAIL_TEMPLATES[0] & { updatedAt: string } | null>(null);

  const { data: smtpData } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn:  () => api.get(API_ROUTES.ADMIN.SETTINGS_EMAIL),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (smtpData) setSmtp(smtpData as typeof smtp);
  }, [smtpData]);

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.SETTINGS_EMAIL, smtp);
    } finally { setSmtpSaving(false); }
  };

  const handleTestEmail = async () => {
    setTestSending(true);
    try {
      await api.post(API_ROUTES.ADMIN.SETTINGS_EMAIL_TEST);
      setTestDone(true);
      setTimeout(() => setTestDone(false), 4000);
    } finally { setTestSending(false); }
  };

  const { data: templates = [] } = useQuery<{ slug: string; updatedAt: string }[]>({
    queryKey: ['email-templates-list'],
    queryFn:  async () => {
      try {
        const result = await api.get<{ slug: string; updatedAt: string }[]>(API_ROUTES.ADMIN.EMAIL_TEMPLATES);
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    staleTime: 300_000,
  });

  const getUpdatedAt = (slug: string) =>
    templates.find((t) => t.slug === slug)?.updatedAt ?? new Date().toISOString();

  return (
    <div className="space-y-5">
      {/* SMTP */}
      <SectionCard title="SMTP Configuration">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <FieldLabel>SMTP Host</FieldLabel>
            <input value={smtp.host} onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
              className={inputCls} placeholder="smtp.sendgrid.net" autoComplete="off" />
          </div>
          <div>
            <FieldLabel>SMTP Port</FieldLabel>
            <input value={smtp.port} onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
              className={inputCls} placeholder="587" autoComplete="off" />
          </div>
          <div>
            <FieldLabel>SMTP User</FieldLabel>
            <input value={smtp.user} onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
              className={inputCls} placeholder="apikey" autoComplete="off" />
          </div>
          <div>
            <FieldLabel>SMTP Password</FieldLabel>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={smtp.password}
                onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
                className={`${inputCls} pr-9`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel>From Name</FieldLabel>
            <input value={smtp.fromName} onChange={(e) => setSmtp((s) => ({ ...s, fromName: e.target.value }))}
              className={inputCls} autoComplete="off" />
          </div>
          <div>
            <FieldLabel>From Email</FieldLabel>
            <input type="email" value={smtp.fromEmail} onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
              className={inputCls} placeholder="noreply@dailydaisy.com" autoComplete="off" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveButton label="Save SMTP" saving={smtpSaving} onClick={handleSaveSmtp} />
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testSending}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-button transition-colors disabled:opacity-50 ${testDone ? 'border-green-400 text-green-600' : 'border-border text-muted hover:border-primary/40 hover:text-primary'}`}
          >
            <Send className="w-3.5 h-3.5" />
            {testSending ? 'Sending…' : testDone ? '✓ Test email sent' : 'Send Test Email'}
          </button>
        </div>
      </SectionCard>

      {/* Templates */}
      <SectionCard title="Email Templates">
        <p className="text-xs text-muted -mt-3">Click Edit to customize the Handlebars template for each transactional email.</p>
        <div className="divide-y divide-border border border-border rounded-card overflow-hidden">
          {EMAIL_TEMPLATES.map((tpl) => (
            <div key={tpl.slug} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/3 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary">{tpl.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Last edited {fmtDate(getUpdatedAt(tpl.slug))}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void preview(`/api/email-preview/${tpl.slug}`, `${tpl.name} Preview`)}
                  className="flex items-center gap-1 text-xs font-medium text-muted border border-border px-2.5 py-1.5 rounded-button hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEditTemplate({ ...tpl, updatedAt: getUpdatedAt(tpl.slug) })}
                  className="flex items-center gap-1 text-xs font-medium bg-primary hover:bg-primary-dark text-white px-2.5 py-1.5 rounded-button transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {editTemplate && (
        <EmailTemplateEditor template={editTemplate} onClose={() => setEditTemplate(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════════════

interface NotifSettings {
  newOrder:          boolean;
  orderNeedsAction:  boolean;
  newReview:         boolean;
  dailySummary:      boolean;
  dailySummaryTime:  string;
  slackWebhook:      string;
}

function NotificationsTab() {
  const [s, setS]       = useState<NotifSettings>({
    newOrder: true, orderNeedsAction: true, newReview: true,
    dailySummary: false, dailySummaryTime: '08:00', slackWebhook: '',
  });
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  useQuery({
    queryKey: ['notif-settings'],
    queryFn:  async () => {
      const data = await api.get<NotifSettings>(API_ROUTES.ADMIN.SETTINGS_NOTIFICATIONS);
      if (data) setS(data);
      return data;
    },
    staleTime: 300_000,
  });

  const set = (k: keyof NotifSettings, v: boolean | string) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.SETTINGS_NOTIFICATIONS, s);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Notification Preferences">
      <div className="space-y-4">
        <Toggle
          checked={s.newOrder}
          onChange={(v) => set('newOrder', v)}
          label="Email me on new order"
          sub="Receive an email notification each time a new order is placed."
        />
        <Toggle
          checked={s.orderNeedsAction}
          onChange={(v) => set('orderNeedsAction', v)}
          label="Email me when order needs action"
          sub="Triggered when an order stays in IN_PRODUCTION for more than 5 days."
        />
        <Toggle
          checked={s.newReview}
          onChange={(v) => set('newReview', v)}
          label="Email me on new customer review"
          sub="Notified when a review is submitted and awaiting moderation."
        />
        <div>
          <Toggle
            checked={s.dailySummary}
            onChange={(v) => set('dailySummary', v)}
            label="Daily sales summary email"
            sub="Receive a daily digest with revenue, orders, and key metrics."
          />
          {s.dailySummary && (
            <div className="ml-12 mt-2">
              <FieldLabel>Send at</FieldLabel>
              <input
                type="time"
                value={s.dailySummaryTime}
                onChange={(e) => set('dailySummaryTime', e.target.value)}
                className={`${inputCls} w-32`}
              />
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <FieldLabel>Slack Webhook URL <span className="text-muted font-normal">(optional)</span></FieldLabel>
          <input
            value={s.slackWebhook}
            onChange={(e) => set('slackWebhook', e.target.value)}
            className={inputCls}
            placeholder="https://hooks.slack.com/services/…"
          />
          <p className="text-xs text-muted/70 mt-1">New orders and daily summaries will also post to this channel.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-button transition-colors disabled:opacity-50 ${done ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving…' : done ? '✓ Saved' : 'Save Preferences'}
      </button>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Team
// ═══════════════════════════════════════════════════════════════════════════════

interface AdminMember {
  id:          string;
  name:        string;
  email:       string;
  role:        'ADMIN' | 'SUPER_ADMIN';
  lastLoginAt?: string;
}

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (email: string, role: string) => Promise<void> }) {
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState('ADMIN');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    setSending(true);
    setError('');
    try {
      await onInvite(email.trim(), role);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to send invite');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[420px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-secondary">Invite Admin</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <FieldLabel required>Email Address</FieldLabel>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className={inputCls} placeholder="newadmin@example.com" />
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <p className="text-xs text-muted/70 mt-1">Super Admins can manage team members and access Danger Zone.</p>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={handleSubmit} disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button disabled:opacity-50 transition-colors">
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery<AdminMember[]>({
    queryKey: ['admin-team'],
    queryFn:  async () => {
      try {
        const result = await api.get<AdminMember[]>(API_ROUTES.ADMIN.TEAM);
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    staleTime: 120_000,
  });

  const handleInvite = async (email: string, role: string) => {
    await api.post(API_ROUTES.ADMIN.TEAM_INVITE, { email, role });
    qc.invalidateQueries({ queryKey: ['admin-team'] });
    setInviteOpen(false);
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!await confirm(`Revoke admin access for ${name}? They will be logged out immediately.`, { confirmLabel: 'Revoke', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.TEAM_MEMBER(id));
    qc.invalidateQueries({ queryKey: ['admin-team'] });
  };

  const handleRoleChange = async (id: string, role: string) => {
    await api.patch(API_ROUTES.ADMIN.TEAM_MEMBER(id), { role });
    qc.invalidateQueries({ queryKey: ['admin-team'] });
  };

  return (
    <SectionCard title="Admin Accounts">
      <div className="flex items-center justify-between -mt-3 mb-1">
        <p className="text-xs text-muted">{members.length} admin{members.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-button transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Invite Admin
        </button>
      </div>

      <div className="border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {['Name', 'Email', 'Role', 'Last Login', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/3 transition-colors">
                    <td className="px-4 py-3 font-medium text-secondary">{m.name}</td>
                    <td className="px-4 py-3 text-muted text-xs font-mono">{m.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="text-xs border border-border rounded-button px-2 py-1 bg-background focus:outline-none"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {m.lastLoginAt ? fmtDateTime(m.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevoke(m.id, m.name)}
                        className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvite={handleInvite} />}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5 — Danger Zone
// ═══════════════════════════════════════════════════════════════════════════════

function DangerAction({
  title,
  description,
  buttonLabel,
  icon: Icon,
  onConfirm,
}: {
  title:       string;
  description: string;
  buttonLabel: string;
  icon:        React.ElementType;
  onConfirm:   () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const ready = confirm === 'CONFIRM';

  const handleClick = async () => {
    if (!ready) return;
    setRunning(true);
    setError('');
    try {
      await onConfirm();
      setDone(true);
      setConfirm('');
      setTimeout(() => setDone(false), 4000);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Action failed');
    } finally { setRunning(false); }
  };

  return (
    <div className="flex items-start justify-between gap-6 py-5 border-b border-red-100 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-secondary text-sm">{title}</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {done  && <p className="text-xs text-green-600 mt-1">✓ Done</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-2">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.toUpperCase())}
          placeholder='Type "CONFIRM"'
          className={`w-36 px-2.5 py-1.5 text-xs border rounded-button bg-background focus:outline-none font-mono ${ready ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-border focus:ring-2 focus:ring-muted/20'}`}
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={!ready || running}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 border border-red-300 hover:bg-red-50 rounded-button transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
          {running ? 'Running…' : buttonLabel}
        </button>
      </div>
    </div>
  );
}

function DangerZoneTab() {
  const handleFlushRedis = async () => {
    await api.post(API_ROUTES.ADMIN.CACHE_FLUSH);
  };

  const handleSyncMegaMenu = async () => {
    await api.post(API_ROUTES.ADMIN.CATALOG_SYNC);
  };

  const handleExport = async () => {
    const res = await adminApi.get(API_ROUTES.ADMIN.EXPORT_DATA, { responseType: 'blob' });
    const blob = res.data as Blob;
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `daily-daisy-export-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-2 border-red-200 rounded-card bg-red-50/30 p-6">
      <div className="flex items-start gap-3 mb-5 pb-5 border-b border-red-200">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-red-700">Danger Zone</h4>
          <p className="text-xs text-red-500 mt-0.5">
            These actions are irreversible or have significant system impact. Type{' '}
            <code className="font-mono bg-red-100 px-1 rounded">CONFIRM</code> before each action to proceed.
          </p>
        </div>
      </div>

      <DangerAction
        title="Flush Redis Cache"
        description="Clears all cached data including mega menu, product data, and session caches. May temporarily slow down the store while caches are rebuilt."
        buttonLabel="Flush Cache"
        icon={RefreshCw}
        onConfirm={handleFlushRedis}
      />
      <DangerAction
        title="Re-sync Mega Menu"
        description="Rebuilds the MongoDB navigation structure from PostgreSQL category data. Use after bulk category changes to ensure the storefront menu is up to date."
        buttonLabel="Re-sync Menu"
        icon={Shield}
        onConfirm={handleSyncMegaMenu}
      />
      <DangerAction
        title="Export All Data"
        description="Downloads a full CSV export of all orders, customers, products, and transactions. This may take a moment for large datasets."
        buttonLabel="Export Data"
        icon={Download}
        onConfirm={handleExport}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 6 — SEO & Analytics
// ═══════════════════════════════════════════════════════════════════════════════

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

interface SeoSettings {
  gaId?:                string;
  googleVerification?:  string;
  metaPixelId?:         string;
}

function SeoTab() {
  const [s,      setS]      = useState<SeoSettings>({});
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  const { data } = useQuery<SeoSettings>({
    queryKey: ['seo-settings'],
    queryFn:  async () => {
      try {
        return await api.get<SeoSettings>(API_ROUTES.ADMIN.SETTINGS_SEO);
      } catch {
        return {};
      }
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const set = (k: keyof SeoSettings, v: string) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.SETTINGS_SEO, s);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Analytics">
        <FormField label="Google Analytics ID">
          <input
            value={safeStr(s.gaId)}
            onChange={(e) => set('gaId', e.target.value)}
            placeholder="G-XXXXXXXXXX"
            className={`${inputCls} w-48 font-mono`}
          />
          <p className="text-xs text-muted mt-1">
            Found in GA4 Admin → Data Streams
          </p>
        </FormField>

        <FormField label="Meta Pixel ID">
          <input
            value={safeStr(s.metaPixelId)}
            onChange={(e) => set('metaPixelId', e.target.value)}
            placeholder="XXXXXXXXXXXXXXXXXX"
            className={`${inputCls} w-48 font-mono`}
          />
          <p className="text-xs text-muted mt-1">
            Found in Meta Events Manager → Pixel settings
          </p>
        </FormField>
      </SectionCard>

      <SectionCard title="Search Console">
        <FormField label="Google Search Console Verification">
          <input
            value={safeStr(s.googleVerification)}
            onChange={(e) => set('googleVerification', e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxx"
            className={`${inputCls} w-96 font-mono`}
          />
          <p className="text-xs text-muted mt-1">
            The content value of the{' '}
            <code className="bg-muted/10 px-1 rounded text-[11px]">google-site-verification</code>
            {' '}meta tag. Found in Search Console → Settings → Ownership verification.
          </p>
        </FormField>
      </SectionCard>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-button transition-colors disabled:opacity-50 ${done ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving…' : done ? '✓ Saved' : 'Save SEO Settings'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Appearance tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SiteThemeSettings {
  primaryRgb:   string;
  primaryDark:  string;
  primaryLight: string;
}

function ThemePresetGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (theme: AdminTheme) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
      {ADMIN_THEMES.map((theme) => {
        const isActive = selected === theme.key;
        const [r, g, b] = theme.primaryRgb.split(' ').map(Number);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        return (
          <button
            key={theme.key}
            type="button"
            onClick={() => onSelect(theme)}
            className={[
              'relative flex flex-col items-center gap-2.5 p-4 rounded-card border-2 transition-all text-center',
              isActive
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 bg-surface',
            ].join(' ')}
          >
            <div className="w-full h-14 rounded-lg overflow-hidden flex shadow-card" aria-hidden>
              <div className="w-6 h-full shrink-0 rounded-l-lg" style={{ backgroundColor: theme.sidebar }} />
              <div className="flex-1 bg-[#F5F5F7] p-1.5 space-y-1">
                <div className="h-2.5 rounded-sm w-4/5" style={{ backgroundColor: hex, opacity: 0.9 }} />
                <div className="h-1.5 rounded-sm w-3/5 bg-[#D1D5DB]" />
                <div className="h-1.5 rounded-sm w-2/5 bg-[#D1D5DB]" />
                <div className="mt-1.5 h-4 rounded-sm w-full" style={{ backgroundColor: hex }} />
              </div>
            </div>
            <span className="text-xs font-semibold text-secondary">{theme.name}</span>
            {isActive && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: hex }}>
                <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4 L4 7 L9 1" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function AppearanceTab() {
  // ── Admin theme (browser-local) ────────────────────────────────────────────
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => {
    if (typeof window === 'undefined') return ADMIN_THEMES[0];
    return loadSavedTheme();
  });

  const handleAdminSelect = (theme: AdminTheme) => {
    setAdminTheme(theme);
    saveTheme(theme);
  };

  // ── Site theme (server-saved, applies to all visitors) ─────────────────────
  const qc = useQueryClient();
  const [siteKey,   setSiteKey]   = useState('coral');
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteDone,   setSiteDone]   = useState(false);

  const { data: siteThemeData } = useQuery<SiteThemeSettings>({
    queryKey: ['site-theme-settings'],
    queryFn:  () => api.get<SiteThemeSettings>(API_ROUTES.ADMIN.SETTINGS_THEME),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!siteThemeData) return;
    const match = ADMIN_THEMES.find((t) => t.primaryRgb === siteThemeData.primaryRgb);
    if (match) setSiteKey(match.key);
  }, [siteThemeData]);

  const handleSiteSave = async () => {
    const theme = ADMIN_THEMES.find((t) => t.key === siteKey) ?? ADMIN_THEMES[0];
    setSiteSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.SETTINGS_THEME, {
        primaryRgb:   theme.primaryRgb,
        primaryDark:  theme.primaryDark,
        primaryLight: theme.primaryLight,
      });
      qc.invalidateQueries({ queryKey: ['site-theme-settings'] });
      setSiteDone(true);
      setTimeout(() => setSiteDone(false), 3000);
    } finally { setSiteSaving(false); }
  };

  const activeSite = ADMIN_THEMES.find((t) => t.key === siteKey) ?? ADMIN_THEMES[0];

  return (
    <div className="space-y-5">
      {/* ── Site Theme ──────────────────────────────────────────────────────── */}
      <SectionCard title="Site Color Theme">
        <p className="text-sm text-muted -mt-2">
          Choose the primary colour for the customer-facing storefront. Changes are saved to the server and apply to all visitors within 5 minutes.
        </p>

        <ThemePresetGrid selected={siteKey} onSelect={(t) => setSiteKey(t.key)} />

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-button shrink-0" style={{ backgroundColor: `rgb(${activeSite.primaryRgb.replace(/ /g, ',')})` }} />
            <div>
              <p className="text-sm font-medium text-secondary">Selected: {activeSite.name}</p>
              <p className="text-xs text-muted">#{activeSite.primaryRgb.split(' ').map((n) => parseInt(n).toString(16).padStart(2, '0')).join('')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSiteSave}
            disabled={siteSaving}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-button transition-colors disabled:opacity-50 ${siteDone ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}
          >
            <Save className="w-3.5 h-3.5" />
            {siteSaving ? 'Saving…' : siteDone ? '✓ Saved' : 'Apply to Site'}
          </button>
        </div>
      </SectionCard>

      {/* ── Admin Theme (browser-only) ──────────────────────────────────────── */}
      <SectionCard title="Admin Interface Theme">
        <p className="text-sm text-muted -mt-2">
          Choose a colour scheme for this admin panel. Saved to this browser only — does not affect the storefront.
        </p>

        <ThemePresetGrid selected={adminTheme.key} onSelect={handleAdminSelect} />

        <div className="flex items-center gap-3 pt-1 border-t border-border">
          <div className="w-8 h-8 rounded-button shrink-0" style={{ backgroundColor: `rgb(${adminTheme.primaryRgb.replace(/ /g, ',')})` }} />
          <div>
            <p className="text-sm font-medium text-secondary">Active: {adminTheme.name}</p>
            <p className="text-xs text-muted">Primary #{adminTheme.primaryRgb.split(' ').map((n) => parseInt(n).toString(16).padStart(2, '0')).join('')} · Sidebar {adminTheme.sidebar}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab navigation
// ═══════════════════════════════════════════════════════════════════════════════

type TabKey = 'store' | 'email' | 'notifications' | 'team' | 'seo' | 'appearance' | 'danger';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'store',         label: 'Store',           icon: '🏪' },
  { key: 'email',         label: 'Email',            icon: '✉️' },
  { key: 'notifications', label: 'Notifications',    icon: '🔔' },
  { key: 'team',          label: 'Team',             icon: '👥' },
  { key: 'seo',           label: 'SEO & Analytics',  icon: '📈' },
  { key: 'appearance',    label: 'Appearance',       icon: '🎨' },
  { key: 'danger',        label: 'Danger Zone',      icon: '⚠️' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('store');

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="Configure your store, emails, team, and system preferences"
        queryKey={['store-settings']}
      />

      {/* Tab strip */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === t.key
                  ? t.key === 'danger'
                    ? 'border-red-500 text-red-600'
                    : 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary hover:border-border',
              ].join(' ')}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.key === 'danger' && activeTab !== 'danger' && (
                <ChevronRight className="w-3 h-3 opacity-40" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="max-w-[820px]">
        {activeTab === 'store'         && <StoreTab />}
        {activeTab === 'email'         && <EmailTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'team'          && <TeamTab />}
        {activeTab === 'seo'           && <SeoTab />}
        {activeTab === 'appearance'    && <AppearanceTab />}
        {activeTab === 'danger'        && <DangerZoneTab />}
      </div>
    </>
  );
}
