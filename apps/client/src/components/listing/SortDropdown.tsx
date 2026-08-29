'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { SORT_OPTIONS } from './types';

interface SortDropdownProps {
  value:    string;
  onChange: (sort: string) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === value)?.label ?? 'Sort';

  return (
    <>
      {/* ── Desktop: shared select ─────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-sm text-muted whitespace-nowrap">Sort by:</span>
        <Select
          aria-label="Sort products"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={SORT_OPTIONS}
          size="sm"
          className="w-48"
        />
      </div>

      {/* ── Mobile: trigger button ─────────────────────────────────────────── */}
      <button
        onClick={() => setSheetOpen(true)}
        className="md:hidden flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-2"
      >
        <ChevronDown className="w-4 h-4" />
        {currentLabel}
      </button>

      {/* ── Mobile: bottom sheet ──────────────────────────────────────────── */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full bg-surface rounded-t-2xl z-10 pb-safe">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            <div className="px-5 pb-6">
              <h3 className="font-semibold text-secondary mb-4 text-base">Sort by</h3>

              <ul className="space-y-1" role="listbox" aria-label="Sort options">
                {SORT_OPTIONS.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <li key={opt.value} role="option" aria-selected={active}>
                      <button
                        onClick={() => {
                          onChange(opt.value);
                          setSheetOpen(false);
                        }}
                        className={[
                          'w-full flex items-center justify-between px-4 py-3.5 rounded-button text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary/8 text-primary'
                            : 'text-secondary hover:bg-muted/5',
                        ].join(' ')}
                      >
                        {opt.label}
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
