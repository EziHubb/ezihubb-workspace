'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, Store as StoreIcon, X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

export interface StoreOption {
  id:   string;
  name: string;
  slug: string;
}

interface StoresSearchResponse {
  data: StoreOption[];
}

interface StorePickerProps {
  value:      StoreOption | null;
  onChange:   (store: StoreOption | null) => void;
  className?: string;
}

/** Searchable store combobox — lets a platform-context SUPER_ADMIN pick any store to manage, not just their own. */
export function StorePicker({ value, onChange, className = '' }: StorePickerProps) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data, isLoading } = useQuery<StoresSearchResponse>({
    queryKey: ['store-picker-search', debounced],
    queryFn:  () => api.get<StoresSearchResponse>(`${API_ROUTES.ADMIN.STORES}?search=${encodeURIComponent(debounced)}&limit=10`),
    enabled:  open,
    staleTime: 10_000,
  });

  const results = data?.data ?? [];

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium border rounded-button transition-colors',
          'bg-surface border-border text-secondary hover:border-primary/50',
          open ? 'border-primary/60 text-primary' : '',
        ].join(' ')}
      >
        <span className="flex items-center gap-2 min-w-0">
          <StoreIcon className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="truncate">{value ? value.name : 'Select a store to manage…'}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-0.5 rounded hover:bg-muted/10 text-muted hover:text-secondary"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={['w-3.5 h-3.5 text-muted transition-transform', open ? 'rotate-180' : ''].join(' ')} />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 z-40 w-full min-w-[280px] bg-surface border border-border/60 rounded-card shadow-floating p-1.5 animate-fade-in origin-top">
            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores by name…"
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {isLoading && <p className="px-3 py-2 text-xs text-muted">Searching…</p>}
              {!isLoading && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted">No stores found.</p>
              )}
              {results.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => { onChange(store); setOpen(false); setSearch(''); }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-button transition-colors',
                    value?.id === store.id ? 'bg-primary/8 text-primary font-semibold' : 'text-secondary hover:bg-muted/8',
                  ].join(' ')}
                >
                  <span className="truncate">{store.name}</span>
                  <span className="text-xs text-muted truncate">/{store.slug}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
