'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Package, Check } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

export interface PickedProduct {
  id:        string;
  name:      string;
  basePrice: string | number;
  images:    { url: string; isPrimary: boolean }[];
}

interface ListingPickerProps {
  selected:    PickedProduct[];
  onChange:    (products: PickedProduct[]) => void;
  max?:        number;
}

/** Search + multi-select picker for the current store's own listings — reused by
 * the "Set up a sale" specific-listings scope and the bundle offer builder. */
export function ListingPicker({ selected, onChange, max = 50 }: ListingPickerProps) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<PickedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [open,      setOpen]      = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ data: PickedProduct[] }>(
          `${API_ROUTES.ADMIN.PRODUCTS}?q=${encodeURIComponent(query)}&limit=10`,
        );
        const selectedIds = new Set(selected.map((p) => p.id));
        setResults((res.data ?? []).filter((p) => !selectedIds.has(p.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const add = (product: PickedProduct) => {
    if (selected.length >= max) return;
    onChange([...selected, product]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const remove = (id: string) => onChange(selected.filter((p) => p.id !== id));

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((p) => {
            const thumb = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
            return (
              <div key={p.id} className="flex items-center gap-3 p-2 border border-border rounded-button bg-background">
                {thumb ? (
                  <img src={thumb} alt={p.name} className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted/10 shrink-0 flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{p.name}</p>
                  <p className="text-xs text-muted">${Number(p.basePrice).toFixed(2)}</p>
                </div>
                <button type="button" onClick={() => remove(p.id)}
                  className="p-1 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected.length < max && (
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search your listings…"
            />
          </div>

          {open && (query.trim() || results.length > 0) && (
            <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-card shadow-lg overflow-hidden max-h-56 overflow-y-auto">
              {searching && <div className="px-4 py-3 text-sm text-muted">Searching…</div>}
              {!searching && results.length === 0 && query.trim() && (
                <div className="px-4 py-3 text-sm text-muted">No listings found</div>
              )}
              {results.map((p) => {
                const thumb = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
                return (
                  <button type="button" key={p.id} onClick={() => add(p)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/5 transition-colors text-left">
                    {thumb ? (
                      <img src={thumb} alt={p.name} className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted/10 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-secondary truncate">{p.name}</p>
                      <p className="text-xs text-muted">${Number(p.basePrice).toFixed(2)}</p>
                    </div>
                    <Check className="w-3.5 h-3.5 text-primary opacity-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
