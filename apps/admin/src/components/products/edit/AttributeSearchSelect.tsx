'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronDown, HelpCircle, Plus } from 'lucide-react';
import { api } from '../../../lib/api-client';
import type { ProductEditFormValues } from './types';

// ─── useDebounce ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-muted hover:text-secondary transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-secondary text-white text-xs rounded-lg shadow-lg z-30 whitespace-normal leading-snug pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-secondary" />
        </span>
      )}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttributeSearchSelectProps {
  label:          string;
  /** RHF field name — must be a string[] field */
  name:           keyof ProductEditFormValues;
  description?:   string;
  maxSelections?: number;
  /** API endpoint, e.g. "/admin/attributes/color" */
  searchEndpoint: string;
  tooltip?:       string;
  className?:     string;
  placeholder?:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttributeSearchSelect({
  label,
  name,
  description,
  maxSelections = Infinity,
  searchEndpoint,
  tooltip,
  className = '',
  placeholder = 'Type to search…',
}: AttributeSearchSelectProps) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();

  const [inputValue, setInputValue]   = useState('');
  const [isOpen,     setIsOpen]       = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedInput = useDebounce(inputValue, 200);
  const selected       = (watch(name) ?? []) as string[];
  const reached        = maxSelections !== Infinity && selected.length >= maxSelections;

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Fetch suggestions from API
  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ['attribute-search', searchEndpoint, debouncedInput],
    queryFn:  async () => {
      const url = debouncedInput.length > 0
        ? `${searchEndpoint}?q=${encodeURIComponent(debouncedInput)}`
        : searchEndpoint;
      try {
        const raw = await api.get<string[]>(url);
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    enabled:   !reached && (debouncedInput.length >= 1 || isOpen),
    staleTime: 30_000,
  });

  // Filter out already-selected values
  const filteredSuggestions = suggestions.filter((s) => !selected.includes(s));

  // Is the typed value a completely new custom value?
  const trimmed    = inputValue.trim();
  const isCustom   = trimmed.length > 0
    && !suggestions.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())
    && !selected.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase());

  const addValue = useCallback((value: string) => {
    if (reached || !value.trim()) return;
    const v = value.trim();
    if (selected.includes(v)) return;
    setValue(name, [...selected, v] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
    setInputValue('');
    setIsOpen(false);
  }, [reached, selected, setValue, name]);

  const removeValue = (value: string) => {
    setValue(
      name,
      selected.filter((s) => s !== value) as unknown as ProductEditFormValues[typeof name],
      { shouldDirty: true },
    );
  };

  return (
    <div className={className}>
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-sm font-semibold text-secondary underline underline-offset-2 decoration-dashed decoration-border cursor-help">
          {label}
        </label>
        {tooltip && <InfoTooltip text={tooltip} />}
        {maxSelections !== Infinity && (
          <span className="text-xs text-muted">Select up to {maxSelections}</span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted mb-2">{description}</p>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-background border border-border rounded-full text-xs text-secondary"
            >
              {v}
              <button
                type="button"
                onClick={() => removeValue(v)}
                className="text-muted/60 hover:text-secondary transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Typeahead input (hidden when max reached) */}
      {!reached ? (
        <div ref={containerRef} className="relative">
          <div
            className={[
              'flex items-center gap-2 px-3 py-2 text-sm border rounded-button bg-background transition-colors cursor-text',
              isOpen ? 'border-secondary ring-2 ring-secondary/10' : 'border-border hover:border-border/80',
            ].join(' ')}
            onClick={() => { setIsOpen(true); }}
          >
            <input
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed) { e.preventDefault(); addValue(trimmed); }
                if (e.key === 'Escape') { setIsOpen(false); setInputValue(''); }
              }}
              placeholder={placeholder}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted"
            />
            <ChevronDown
              className={`w-4 h-4 text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Dropdown */}
          {isOpen && (filteredSuggestions.length > 0 || isCustom) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-card shadow-lg z-20 max-h-52 overflow-y-auto">
              {filteredSuggestions.slice(0, 20).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addValue(suggestion); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-secondary hover:bg-muted/5 transition-colors border-b border-border last:border-0"
                >
                  {suggestion}
                </button>
              ))}

              {/* Custom value not in dictionary */}
              {isCustom && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addValue(trimmed); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center gap-2 border-t border-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add <span className="font-semibold">"{trimmed}"</span>
                </button>
              )}
            </div>
          )}

          {/* No results message */}
          {isOpen && filteredSuggestions.length === 0 && !isCustom && debouncedInput.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-card shadow-lg z-20 px-4 py-3">
              <p className="text-sm text-muted">No results for "{debouncedInput}"</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted italic">
          Maximum {maxSelections} {maxSelections === 1 ? 'selection' : 'selections'} reached
        </p>
      )}
    </div>
  );
}
