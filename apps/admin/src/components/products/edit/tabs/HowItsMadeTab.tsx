'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Check, ExternalLink, Shield, Package2,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  ProductEditFormValues, WhoMadeIt, HowItWasMade,
} from '../types';
import { RadioGroupWithDesc }    from '../RadioGroupWithDesc';
import { CheckboxGroupWithDesc } from '../CheckboxGroupWithDesc';
import { GPSRModal }             from '../GPSRModal';

// ─── Layout primitives ────────────────────────────────────────────────────────

function TabSection({ title, description, link, children }: {
  title?:       string;
  description?: string;
  link?:        { label: string; href: string };
  children:     React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      {(title || description || link) && (
        <div className="mb-5">
          {title && <h3 className="font-semibold text-secondary">{title}</h3>}
          {description && (
            <p className="text-sm text-muted mt-0.5 max-w-2xl leading-relaxed">
              {description}{' '}
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5">
                  {link.label} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function FormField({ label, required, children }: {
  label:    string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-secondary mb-3">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}

// ─── HS Code section (inline expand) ─────────────────────────────────────────

function HsCodeSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(!!value);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h4 className="font-semibold text-secondary">Customs information</h4>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            This info is used to prefill a customs form when you purchase an international Shipping Label.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {value ? 'Edit tariff number' : '+ Add tariff number'}
        </button>
      </div>

      {value && !expanded && (
        <p className="text-sm text-secondary mt-3">
          HS Code: <code className="font-mono bg-background border border-border rounded px-2 py-0.5 text-xs">{value}</code>
          <button type="button" onClick={() => onChange('')} className="ml-2 text-muted hover:text-red-500 transition-colors">
            <X className="w-3 h-3 inline" />
          </button>
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. 6912.00"
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono placeholder:font-sans placeholder:text-muted"
            />
            {value && (
              <button type="button" onClick={() => setExpanded(false)}
                className="px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                Done
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Look up your code at{' '}
            <a href="https://www.trade-tariff.service.gov.uk/find_commodity" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5">
              trade-tariff.service.gov.uk <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Production partners ──────────────────────────────────────────────────────

interface ProductionPartner {
  id:          string;
  name:        string;
  description?: string;
  location?:   string;
}

function ProductionPartnersSection({
  selectedIds, onChange,
}: {
  selectedIds: string[];
  onChange:    (ids: string[]) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data: allPartners = [] } = useQuery<ProductionPartner[]>({
    queryKey: ['production-partners'],
    queryFn:  () => api.get<ProductionPartner[]>(API_ROUTES.ADMIN.PRODUCTION_PARTNERS),
    staleTime: 5 * 60_000,
  });

  const selected = allPartners.filter((p) => selectedIds.includes(p.id));

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const [newName,     setNewName]     = useState('');
  const [newLoc,      setNewLoc]      = useState('');
  const [creating,    setCreating]    = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<ProductionPartner>(API_ROUTES.ADMIN.PRODUCTION_PARTNERS, {
        name:     newName.trim(),
        location: newLoc.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ['production-partners'] });
      onChange([...selectedIds, created.id]);
      setNewName('');
      setNewLoc('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="border-2 border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <h4 className="font-semibold text-secondary">Production partners for this listing</h4>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              A production partner is anyone who's not a part of your shop who helps you physically produce your items.{' '}
              <a href="https://help.etsy.com/hc/articles/360000336747" target="_blank" rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline">
                Is this required for you?
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add production partners
          </button>
        </div>

        {/* Selected partners */}
        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-background border border-border rounded-full text-sm text-secondary">
                <Package2 className="w-3.5 h-3.5 text-muted" />
                {p.name}
                {p.location && <span className="text-xs text-muted">· {p.location}</span>}
                <button type="button" onClick={() => toggle(p.id)}
                  className="p-0.5 rounded-full hover:bg-muted/10 text-muted hover:text-secondary transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Partners selection modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h4 className="font-semibold text-secondary">Production partners</h4>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-muted/10 text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {allPartners.length === 0 && !showCreate && (
                <p className="text-sm text-muted text-center py-4">No production partners added yet.</p>
              )}

              {allPartners.map((p) => (
                <button key={p.id} type="button" onClick={() => toggle(p.id)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all',
                    selectedIds.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  ].join(' ')}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedIds.includes(p.id) ? 'border-primary bg-primary' : 'border-muted'}`}>
                    {selectedIds.includes(p.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary">{p.name}</p>
                    {p.location && <p className="text-xs text-muted mt-0.5">{p.location}</p>}
                  </div>
                </button>
              ))}

              {/* Create new */}
              {showCreate ? (
                <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-3 mt-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">New production partner</p>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Partner name *"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none placeholder:text-muted" />
                  <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)}
                    placeholder="Location (e.g. New York, NY)"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none placeholder:text-muted" />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreate} disabled={!newName.trim() || creating}
                      className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg disabled:opacity-50 transition-colors">
                      {creating ? 'Adding…' : 'Add partner'}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)}
                      className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-lg hover:border-primary/40 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mt-2">
                  <Plus className="w-4 h-4" />
                  Add new partner
                </button>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border shrink-0 flex justify-between items-center">
              <span className="text-xs text-muted">
                {selectedIds.length} selected
              </span>
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Option data ──────────────────────────────────────────────────────────────

const WHO_MADE_OPTIONS: { value: WhoMadeIt; label: string }[] = [
  { value: 'I_DID',           label: 'I did' },
  { value: 'SHOP_MEMBER',     label: 'A member of my shop' },
  { value: 'ANOTHER_COMPANY', label: 'Another company or person' },
];

const HOW_MADE_OPTIONS: { value: HowItWasMade; label: string; desc: string; examples: string }[] = [
  {
    value:    'MADE_TO_ORDER',
    label:    "It's made to order",
    desc:     'Each item is made fresh after a purchase is made.',
    examples: 'Examples: A necklace made with a customer\'s birthstone.',
  },
  {
    value:    'ASSEMBLED',
    label:    "It's assembled from purchased parts",
    desc:     'My shop assembles this item using some commercially available supplies, components, or parts, such as jewelry charms, patches, etc.',
    examples: 'Examples: A necklace chain with jewelry charms attached; a denim jacket with patches sewn on.',
  },
  {
    value:    'ALTERED',
    label:    "It's an item that my shop alters",
    desc:     'My shop alters or customises a commercially available base item, such as a t-shirt or mug.',
    examples: 'Examples: A tote bag with flowers embroidered on it; a tumbler with a laser engraved design.',
  },
  {
    value:    'CURATED_SET',
    label:    "It's a curated set of purchased goods",
    desc:     'My shop curates a themed assortment that includes some commercially available goods.',
    examples: 'Examples: A spa kit that contains a candle, face mask, herbal tea, etc.',
  },
  {
    value:    'NATURAL_MATERIAL',
    label:    "It's a natural material",
    desc:     'My shop finds or cultivates this item from nature.',
    examples: 'Examples: Crystals, plants, shells, etc.',
  },
];

const TOOL_OPTIONS: { value: string; label: string; desc?: string; examples?: string }[] = [
  {
    value:    'handheld',
    label:    'Handheld or hand-guided tools',
    desc:     undefined,
    examples: 'Examples: sewing needles, paintbrush, sewing machine, table saw, etc.',
  },
  {
    value:    'computerized',
    label:    'Computerized tools or machines',
    desc:     undefined,
    examples: 'Examples: laser printer, computerized embroidery machine, Cricut machine, CNC machine, 3D printer, etc.',
  },
  {
    value:    'none',
    label:    "None, I don't use tools",
    desc:     undefined,
    examples: undefined,
  },
];

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function HowItsMadeTab({ productId }: { productId?: string }) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();

  const hsCode     = watch('hsCode')               ?? '';
  const gpsrInfo   = watch('gpsrInfo');
  const partnerIds = watch('productionPartnerIds') ?? [];

  const [showGpsrModal, setShowGpsrModal] = useState(false);

  const hasGpsr = !!(
    gpsrInfo &&
    (gpsrInfo.manufacturerName || gpsrInfo.manufacturerAddress || gpsrInfo.manufacturerEmail)
  );

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden divide-y divide-border">

        {/* ── GPSR & Customs (Image 13) ────────────────────────────────── */}
        <div className="px-6 py-7 space-y-6 border-b border-border">
          {/* GPSR */}
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h4 className="font-semibold text-secondary">GPSR manufacturer and safety information</h4>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                If you're a{' '}
                <a href="#" className="text-primary underline-offset-2 hover:underline">trader</a>{' '}
                selling to{' '}
                <a href="#" className="text-primary underline-offset-2 hover:underline">EEA states</a>{' '}
                or Northern Ireland (NI), you may need to include manufacturer and safety info to comply
                with the{' '}
                <a href="#" className="text-primary underline-offset-2 hover:underline">
                  General Product Safety Regulation
                </a>{' '}
                (GPSR).
              </p>

              {/* Summary of saved GPSR info */}
              {hasGpsr && (
                <div className="mt-2 text-xs text-secondary bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-0.5">
                  {gpsrInfo?.manufacturerName    && <p><strong>Name:</strong> {gpsrInfo.manufacturerName}</p>}
                  {gpsrInfo?.manufacturerEmail   && <p><strong>Email:</strong> {gpsrInfo.manufacturerEmail}</p>}
                  {gpsrInfo?.countryOfOrigin     && <p><strong>Country:</strong> {gpsrInfo.countryOfOrigin}</p>}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowGpsrModal(true)}
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              {hasGpsr ? 'Edit info' : '+ Add info'}
            </button>
          </div>

          {/* HS Code / Customs */}
          <HsCodeSection
            value={hsCode}
            onChange={(v) => setValue('hsCode', v, { shouldDirty: true })}
          />
        </div>

        {/* ── How it's made (Images 13-15) ────────────────────────────── */}
        <TabSection
          title="How it's made"
          description="We want to know more about how your item was made, and so do buyers."
          link={{ label: 'Learn more about what types of items are allowed', href: '#' }}
        >
          <div className="space-y-8">
            {/* Who made it? */}
            <FormField label="Who made it?" required>
              <RadioGroupWithDesc name="whoMadeIt" options={WHO_MADE_OPTIONS} />
            </FormField>

            {/* What is it? */}
            <FormField label="What is it?" required>
              <RadioGroupWithDesc name="howItWasMade" options={HOW_MADE_OPTIONS} />
            </FormField>

            {/* What tools? */}
            <FormField label="What tools are used to make this item?">
              <p className="text-sm text-muted mb-3">Select all that apply.</p>
              <CheckboxGroupWithDesc name="toolsUsed" options={TOOL_OPTIONS} />
            </FormField>

            {/* Production partners */}
            <ProductionPartnersSection
              selectedIds={partnerIds}
              onChange={(ids) => setValue('productionPartnerIds', ids, { shouldDirty: true })}
            />
          </div>
        </TabSection>
      </div>

      {/* GPSR modal — API-saving (edit mode only; create mode has no productId yet) */}
      {productId && (
        <GPSRModal
          productId={productId}
          isOpen={showGpsrModal}
          onClose={() => setShowGpsrModal(false)}
        />
      )}
    </div>
  );
}
