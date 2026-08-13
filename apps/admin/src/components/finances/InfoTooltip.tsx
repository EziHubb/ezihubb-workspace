'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/** Small "?" icon that reveals a help popover on click — matches Etsy's inline
 *  explainer tooltips (e.g. "net profit", "total balance" on Payment account). */
export function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label="More information"
        className="text-muted hover:text-secondary transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-30 top-6 left-0 w-72 bg-surface border border-border rounded-card shadow-floating p-4 text-xs text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </span>
  );
}

/** Dotted-underline text that opens the same style of tooltip on click —
 *  matches Etsy's "net profit"/"total balance" underlined trigger text.
 *  `children` is the trigger label, `tooltip` is the popover content. */
export function TooltipTerm({ children, tooltip }: { children: React.ReactNode; tooltip: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="font-semibold underline decoration-dotted decoration-1 underline-offset-2 text-secondary"
      >
        {children}
      </button>
      {open && (
        <div className="absolute z-30 top-6 left-0 w-72 bg-surface border border-border rounded-card shadow-floating p-4 text-xs text-secondary leading-relaxed">
          {tooltip}
        </div>
      )}
    </span>
  );
}
