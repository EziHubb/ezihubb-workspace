'use client';

import React, { useEffect, useRef, useState } from 'react';

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'bottom-center' | 'top-start' | 'top-end';

export interface PopoverProps {
  /** The element that opens the popover on click. */
  trigger:    React.ReactNode;
  children:   React.ReactNode;
  placement?: PopoverPlacement;
  className?: string;
  /** Fixed width for the panel (e.g. "20rem"). Defaults to content width, min 16rem. */
  width?:     string;
}

const placementClasses: Record<PopoverPlacement, string> = {
  'bottom-start':  'top-full left-0 mt-2',
  'bottom-end':    'top-full right-0 mt-2',
  'bottom-center': 'top-full left-1/2 -translate-x-1/2 mt-2',
  'top-start':     'bottom-full left-0 mb-2',
  'top-end':       'bottom-full right-0 mb-2',
};

/**
 * Small anchored floating panel — used for Etsy's two recurring patterns:
 * an info-icon term explainer (e.g. "net profit", "total balance" in
 * Finances) and a lightweight inline quick-edit form (e.g. "Edit origin
 * post code" in Delivery settings). Distinct from `Modal`, which is a
 * full centered/bottom-sheet dialog for bigger flows.
 */
export function Popover({ trigger, children, placement = 'bottom-start', className = '', width }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex align-middle">
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          style={width ? { width } : undefined}
          className={[
            'absolute z-30 min-w-64 bg-surface border border-border rounded-card shadow-floating p-4 animate-fade-in',
            placementClasses[placement],
            className,
          ].join(' ')}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Bold-term + explanation body, matching Etsy's info-icon tooltip content shape. */
export function PopoverTermExplainer({
  term, children,
}: {
  term:     string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm text-secondary leading-relaxed">
      <p className="font-bold mb-1">{term}</p>
      <div className="text-muted">{children}</div>
    </div>
  );
}
