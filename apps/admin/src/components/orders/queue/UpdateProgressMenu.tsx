'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ProgressStep } from './types';

/**
 * Jump one or more orders to a step.
 *
 * The last step is not in the list — it is the button underneath. It is the
 * only step that tells the buyer anything, so it should not sit in a column of
 * private bookkeeping labels where it can be clicked by accident.
 */

interface Props {
  steps:     ProgressStep[];
  currentStepId?: string | null;
  onPick:    (stepId: string) => void;
  onClose:   () => void;
  /** Anchors the panel to the button that opened it. */
  align?:    'left' | 'right';
}

export function UpdateProgressMenu({ steps, currentStepId, onPick, onClose, align = 'right' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const completed = steps.find((s) => s.kind === 'COMPLETED');
  const rest      = steps.filter((s) => s.kind !== 'COMPLETED');

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute top-full z-20 mt-1 w-56 rounded-card border border-border bg-surface py-2 shadow-lg ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {rest.map((step) => (
        <button
          key={step.id}
          type="button"
          role="menuitem"
          onClick={() => onPick(step.id)}
          className={`block w-full px-4 py-2 text-left text-sm hover:bg-background ${
            step.id === currentStepId ? 'font-semibold text-secondary' : 'text-secondary'
          }`}
        >
          {step.name}
        </button>
      ))}

      {completed && (
        <div className="mt-2 border-t border-border px-3 pt-2">
          <button
            type="button"
            role="menuitem"
            onClick={() => onPick(completed.id)}
            className="flex w-full items-center justify-center gap-1 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Complete order
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
