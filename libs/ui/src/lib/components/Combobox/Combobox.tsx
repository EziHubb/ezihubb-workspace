'use client';

import React, { useMemo, useState } from 'react';

export interface ComboboxOption {
  value:     string;
  label:     string;
  sublabel?: string;
  image?:    string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options:            ComboboxOption[];
  selected:           string[];
  onChange:           (values: string[]) => void;
  /** Called on every keystroke — omit to filter `options` locally by label instead. */
  onSearch?:          (query: string) => void;
  searchPlaceholder?: string;
  multiple?:          boolean;
  maxHeight?:         string;
  emptyMessage?:      string;
  isLoading?:         boolean;
  className?:         string;
}

/**
 * Search-and-select-with-checkboxes list — Etsy's listing picker (Bundle
 * offers, Sales "Select listings") and category picker both follow this
 * shape: search box → scrollable checkbox rows, each with a thumbnail and
 * two-line label. Consolidates the logic several admin components
 * (ListingPicker, AttributeSearchSelect, CategoryPickerModal) each
 * re-implemented ad hoc.
 */
export function Combobox({
  options, selected, onChange, onSearch, searchPlaceholder = 'Search…',
  multiple = true, maxHeight = '20rem', emptyMessage = 'No results found.',
  isLoading, className = '',
}: ComboboxProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (onSearch) return options; // caller owns filtering
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, onSearch]);

  const toggle = (value: string) => {
    if (!multiple) { onChange([value]); return; }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className={className}>
      <div className="relative mb-3">
        <svg aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-9 pr-3 text-sm rounded-pill border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
      </div>

      <div className="overflow-y-auto space-y-1" style={{ maxHeight }}>
        {isLoading && (
          <p className="text-sm text-muted text-center py-6">Loading…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted text-center py-6">{emptyMessage}</p>
        )}
        {!isLoading && filtered.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => toggle(opt.value)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'shrink-0 flex items-center justify-center w-4 h-4 border-2',
                  multiple ? 'rounded' : 'rounded-full',
                  isSelected ? 'border-primary bg-primary' : 'border-muted',
                ].join(' ')}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4 L4 7 L9 1" />
                  </svg>
                )}
              </span>
              {opt.image && (
                <img src={opt.image} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-secondary truncate">{opt.label}</span>
                {opt.sublabel && <span className="block text-xs text-muted truncate">{opt.sublabel}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
