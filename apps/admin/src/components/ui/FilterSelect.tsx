'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  /** Small (w-3.5 h-3.5) icon shown before the label, both in the trigger and the option row. */
  icon?: ReactNode;
}

interface FilterSelectProps {
  value:     string;
  onChange:  (value: string) => void;
  options:   FilterOption[];
  className?: string;
  align?:    'left' | 'right';
  size?:     'sm' | 'md';
}

export function FilterSelect({
  value,
  onChange,
  options,
  className = '',
  align = 'left',
  size = 'md',
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const triggerCls = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';

  const dropdownAlign = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          triggerCls,
          'w-full flex items-center justify-between gap-2 font-semibold border rounded-pill transition-colors',
          'bg-surface border-border text-secondary',
          'hover:border-primary/50 hover:text-secondary',
          open ? 'border-primary/60 text-primary' : '',
        ].join(' ')}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected?.icon}
          <span className="whitespace-nowrap">{selected?.label}</span>
        </span>
        <ChevronDown
          className={[
            'w-3.5 h-3.5 text-muted transition-transform shrink-0',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={[
              'absolute top-full mt-2 z-40 min-w-[180px] bg-surface',
              'border border-border/60 rounded-card shadow-floating p-1.5',
              'animate-fade-in origin-top',
              dropdownAlign,
            ].join(' ')}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left rounded-button transition-colors',
                    active
                      ? 'bg-primary/8 text-primary font-semibold'
                      : 'text-secondary hover:bg-muted/8',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
