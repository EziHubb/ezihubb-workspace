'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from '../../lib/currency/currency-context';

export function CurrencyPicker() {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen]       = useState(false);

  const current = SUPPORTED_CURRENCIES.find((c) => c.code === currency) ?? SUPPORTED_CURRENCIES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Select display currency"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors px-2 py-1 rounded-lg hover:bg-muted/10"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span>{current.code}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Dropdown */}
          <div
            role="listbox"
            aria-label="Display currency"
            className="absolute right-0 top-full mt-1 w-38 bg-surface rounded-xl shadow-floating border border-border z-50 overflow-hidden py-1"
          >
            {SUPPORTED_CURRENCIES.map((c) => {
              const isSelected = c.code === currency;
              return (
                <button
                  key={c.code}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => { setCurrency(c.code as CurrencyCode); setIsOpen(false); }}
                  className={[
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left',
                    isSelected
                      ? 'bg-primary/5 font-semibold text-primary'
                      : 'text-secondary hover:bg-muted/5',
                  ].join(' ')}
                >
                  <span className="text-base" aria-hidden="true">{c.flag}</span>
                  <span className="flex-1">{c.code}</span>
                  {isSelected && <Check className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
