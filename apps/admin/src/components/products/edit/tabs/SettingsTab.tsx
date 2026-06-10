'use client';

import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import type { ProductEditFormValues, RenewalType } from '../types';
import { RelatedProductsPicker } from '../RelatedProductsPicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopSection { id: string; name: string; sortOrder: number }

// ── Layout primitives ─────────────────────────────────────────────────────────

function TabSection({ title, description, children }: {
  title?:       string;
  description?: string;
  children:     React.ReactNode;
}) {
  return (
    <div className="px-6 py-7">
      {(title || description) && (
        <div className="mb-7">
          {title && <h3 className="font-semibold text-secondary">{title}</h3>}
          {description && (
            <p className="text-sm text-muted mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function SettingsRow({ label, description, children, className = '' }: {
  label:        string;
  description?: string;
  children:     React.ReactNode;
  className?:   string;
}) {
  return (
    <div className={`flex items-start justify-between gap-8 ${className}`}>
      <div className="max-w-lg">
        <span className="text-sm font-semibold text-secondary">{label}</span>
        {description && <p className="text-sm text-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FormField({ label, required, description, link, children, className = '' }: {
  label:        string;
  required?:    boolean;
  description?: string;
  link?:        { label: string; href: string };
  children:     React.ReactNode;
  className?:   string;
}) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-secondary mb-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {(description || link) && (
        <p className="text-sm text-muted mb-3 leading-relaxed">
          {description}{' '}
          {link && (
            <a href={link.href} target="_blank" rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5">
              {link.label} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </p>
      )}
      {children}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Renewal radio group ───────────────────────────────────────────────────────

function RenewalRadio({
  value,
  onChange,
  expiresAt,
}: {
  value:     RenewalType;
  onChange:  (v: RenewalType) => void;
  expiresAt?: string | null;
}) {
  // If currently manual + has an expiresAt, show it; otherwise estimate 4 months from now
  const expiryDate = expiresAt
    ? format(new Date(expiresAt), 'MMMM d, yyyy')
    : format(addMonths(new Date(), 4), 'MMMM d, yyyy');

  const options: { value: RenewalType; label: string; desc: string }[] = [
    {
      value: 'AUTOMATIC',
      label: 'Automatic',
      desc:  'This listing will renew as it expires (recommended).',
    },
    {
      value: 'MANUAL',
      label: 'Manual',
      desc:  `Expires on ${expiryDate}`,
    },
  ];

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-start gap-3 px-4 py-3.5 rounded-lg border-2 text-left w-full transition-all',
              selected ? 'border-primary bg-primary/3' : 'border-border hover:border-primary/40',
            ].join(' ')}
          >
            <div className={[
              'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
              selected ? 'border-primary' : 'border-muted',
            ].join(' ')}>
              {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
                {opt.label}
              </p>
              <p className="text-sm text-muted mt-0.5">{opt.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function SettingsTab({ productId, initialRelatedIds }: { productId?: string; initialRelatedIds?: string[] } = {}) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();

  const shopSectionId = watch('shopSectionId')  ?? '';
  const isFeatured    = watch('isFeatured')      ?? false;
  const isAdsEnabled  = watch('isAdsEnabled')    ?? false;
  const renewalType   = watch('renewalType')     ?? 'AUTOMATIC';
  const expiresAt     = watch('expiresAt' as keyof ProductEditFormValues) as string | null | undefined;

  const { data: sections = [] } = useQuery<ShopSection[]>({
    queryKey: ['shop-sections'],
    queryFn:  () => api.get<ShopSection[]>(API_ROUTES.ADMIN.SHOP_SECTIONS),
    staleTime: 10 * 60_000,
  });

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        <TabSection
          title="Settings"
          description="Choose how this listing will display in your shop, how it will renew, and if you want it to be promoted."
        >
          <div className="space-y-8">

            {/* ── Shop section ────────────────────────────────────────── */}
            <FormField
              label="Shop section"
              description="Use shop sections to organise your products into groups shoppers can explore."
            >
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={shopSectionId}
                  onChange={(e) => setValue('shopSectionId', e.target.value || null, { shouldDirty: true })}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[240px]"
                >
                  <option value="">Select a section…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <a
                  href="/catalog/categories"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline underline-offset-2 flex items-center gap-1"
                >
                  Manage sections <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </FormField>

            {/* ── Divider ──────────────────────────────────────────────── */}
            <div className="border-t border-border" />

            {/* ── Feature this listing ─────────────────────────────────── */}
            <SettingsRow
              label="Feature this listing"
              description="Showcase this listing at the top of your shop home to make it stand out."
            >
              <Toggle
                checked={isFeatured}
                onChange={(v) => setValue('isFeatured', v, { shouldDirty: true })}
              />
            </SettingsRow>

            {/* ── Ads ──────────────────────────────────────────────────── */}
            <SettingsRow
              label="Ads"
              description="Promote this listing as part of your ads campaign."
            >
              <Toggle
                checked={isAdsEnabled}
                onChange={(v) => setValue('isAdsEnabled', v, { shouldDirty: true })}
              />
            </SettingsRow>

            {/* ── Divider ──────────────────────────────────────────────── */}
            <div className="border-t border-border" />

            {/* ── Renewal options ──────────────────────────────────────── */}
            <FormField
              label="Renewal options"
              required
              description="Each renewal lasts for four months or until the listing sells out."
              link={{ label: 'Get more details on auto-renewing.', href: '#' }}
            >
              <RenewalRadio
                value={renewalType as RenewalType}
                onChange={(v) => setValue('renewalType', v, { shouldDirty: true })}
                expiresAt={expiresAt as string | null | undefined}
              />
            </FormField>

            {/* ── Related products ─────────────────────────────────────── */}
            {productId && (
              <>
                <div className="border-t border-border" />
                <FormField
                  label="Related products"
                  description="Pin up to 4 products to show as recommendations on this listing's page. Overrides automatic related products."
                >
                  <RelatedProductsPicker
                    productId={productId}
                    initialIds={initialRelatedIds}
                  />
                </FormField>
              </>
            )}

          </div>
        </TabSection>
      </div>
    </div>
  );
}
