'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';

// ── Country data ──────────────────────────────────────────────────────────────

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand',    flag: '🇳🇿' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪' },
  { code: 'FR', name: 'France',         flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands',    flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden',         flag: '🇸🇪' },
  { code: 'NO', name: 'Norway',         flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark',        flag: '🇩🇰' },
  { code: 'CH', name: 'Switzerland',    flag: '🇨🇭' },
  { code: 'AT', name: 'Austria',        flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium',        flag: '🇧🇪' },
  { code: 'PL', name: 'Poland',         flag: '🇵🇱' },
  { code: 'JP', name: 'Japan',          flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea',    flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong',      flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan',         flag: '🇹🇼' },
  { code: 'MY', name: 'Malaysia',       flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand',       flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines',    flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam',        flag: '🇻🇳' },
  { code: 'IN', name: 'India',          flag: '🇮🇳' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia',   flag: '🇸🇦' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦' },
];

// ── Multi-select dropdown ──────────────────────────────────────────────────────

function CountryMultiSelect({
  value,
  onChange,
}: {
  value:    string[];
  onChange: (codes: string[]) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const selectedCountries = COUNTRIES.filter((c) => value.includes(c.code));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-left"
      >
        <span className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedCountries.length === 0 ? (
            <span className="text-muted">Select countries…</span>
          ) : selectedCountries.length > 4 ? (
            <span className="text-secondary">
              {selectedCountries.slice(0, 3).map((c) => c.flag).join(' ')} +{selectedCountries.length - 3} more
            </span>
          ) : (
            selectedCountries.map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1 text-xs bg-primary/8 text-primary font-medium px-1.5 py-0.5 rounded-full">
                {c.flag} {c.code}
              </span>
            ))
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-surface border border-border/60 rounded-card shadow-floating animate-fadeIn origin-top overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-button bg-background focus:outline-none"
              />
            </div>
          </div>

          {/* Select all / clear */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-background">
            <button type="button" onClick={() => onChange(COUNTRIES.map((c) => c.code))}
              className="text-[11px] text-primary hover:underline">Select all</button>
            <button type="button" onClick={() => onChange([])}
              className="text-[11px] text-muted hover:underline">Clear</button>
          </div>

          {/* Country list */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.map((c) => (
              <label
                key={c.code}
                className="flex items-center gap-3 px-3 py-2 rounded-button hover:bg-muted/8 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={value.includes(c.code)}
                  onChange={() => toggle(c.code)}
                  className="w-4 h-4 accent-primary rounded shrink-0"
                />
                <span className="text-base leading-none">{c.flag}</span>
                <span className="text-sm text-secondary">{c.name}</span>
                <span className="ml-auto text-xs text-muted font-mono">{c.code}</span>
              </label>
            ))}
          </div>

          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-border/60 bg-background">
              <p className="text-xs text-muted">{value.length} countr{value.length !== 1 ? 'ies' : 'y'} selected</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShippingZoneFormData {
  name:      string;
  countries: string[];
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ShippingZoneModalProps {
  zone?: { id: string; name: string; countries: string[] } | null;
  onClose:  () => void;
  onSave:   (data: ShippingZoneFormData, id?: string) => Promise<void>;
}

export function ShippingZoneModal({ zone, onClose, onSave }: ShippingZoneModalProps) {
  const isEdit = !!zone?.id;

  const [name,      setName]      = useState(zone?.name      ?? '');
  const [countries, setCountries] = useState<string[]>(zone?.countries ?? []);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())        e.name      = 'Zone name is required';
    if (!countries.length)   e.countries = 'Select at least one country';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), countries }, zone?.id);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-secondary">{isEdit ? 'Edit Shipping Zone' : 'New Shipping Zone'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Zone name */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Zone Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted ${errors.name ? 'border-red-400' : 'border-border'}`}
              placeholder="e.g. North America, Europe…"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Countries */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Countries <span className="text-red-400">*</span>
            </label>
            <CountryMultiSelect value={countries} onChange={setCountries} />
            {errors.countries && <p className="text-xs text-red-600 mt-1">{errors.countries}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : (isEdit ? 'Save Zone' : 'Create Zone')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
