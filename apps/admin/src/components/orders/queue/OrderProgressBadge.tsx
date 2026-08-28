'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProgressStep, StepKind } from './types';

const STEP_STYLE: Record<StepKind, string> = {
  NEW:       'bg-blue-100 text-blue-800',
  CUSTOM:    'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export function OrderProgressBadge({
  step,
  size = 'md',
}: {
  step: Pick<ProgressStep, 'name' | 'kind'> | null;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-pill font-semibold ${cls} ${
      step ? STEP_STYLE[step.kind] : 'bg-gray-100 text-gray-600'
    }`}>
      {step?.name ?? 'Unassigned'}
    </span>
  );
}

export function OrderProgressSelect({
  value,
  steps,
  disabled,
  onChange,
}: {
  value: Pick<ProgressStep, 'id' | 'name' | 'kind'> | null;
  steps: ProgressStep[];
  disabled?: boolean;
  onChange: (stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-button border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <OrderProgressBadge step={value} />
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-card border border-border/60 bg-background p-1.5 shadow-floating"
        >
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="option"
              aria-selected={step.id === value?.id}
              onClick={() => {
                if (step.id !== value?.id) onChange(step.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-button px-3 py-2 transition-colors hover:bg-muted/8 ${
                step.id === value?.id ? 'bg-primary/8' : ''
              }`}
            >
              <OrderProgressBadge step={step} />
              {step.id === value?.id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
