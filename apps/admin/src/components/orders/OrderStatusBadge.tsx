'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:  { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED:        { label: 'Confirmed',        color: 'bg-blue-100 text-blue-800'   },
  IN_PRODUCTION:    { label: 'In Production',    color: 'bg-purple-100 text-purple-800'},
  SHIPPED:          { label: 'Shipped',           color: 'bg-cyan-100 text-cyan-800'   },
  DELIVERED:        { label: 'Delivered',         color: 'bg-teal-100 text-teal-800'   },
  COMPLETED:        { label: 'Completed',         color: 'bg-green-100 text-green-800' },
  CANCELLED:        { label: 'Cancelled',         color: 'bg-red-100 text-red-800'     },
  REFUND_REQUESTED: { label: 'Refund Requested',  color: 'bg-orange-100 text-orange-800'},
  REFUNDED:         { label: 'Refunded',          color: 'bg-gray-100 text-gray-700'   },
  DISPUTED:         { label: 'Disputed',          color: 'bg-red-50 text-red-600'      },
};

/**
 * Every status that exists, for rendering a badge.
 */
export const ALL_STATUSES = Object.keys(STATUS_CONFIG);

/**
 * What the status picker may OFFER, which is a shorter list.
 *
 * COMPLETED is owned by the shop's progress steps — the API refuses it on
 * the status route, so listing it here was a menu entry whose only possible
 * outcome was an error toast. The current value is still rendered even when
 * it is not offered, so an order that is already completed reads correctly.
 */
const NOT_SETTABLE_HERE = ['COMPLETED'];
export const SETTABLE_STATUSES = ALL_STATUSES.filter((s) => !NOT_SETTABLE_HERE.includes(s));

interface OrderStatusBadgeProps {
  status: string;
  size?:  'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const cfg  = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  const cls  = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-semibold rounded-pill ${cfg.color} ${cls} whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
}

// ── StatusSelect ──────────────────────────────────────────────────────────────

interface StatusSelectProps {
  value:     string;
  onChange:  (s: string) => void;
  /** Which statuses to offer. Defaults to everything this picker may set. */
  options?:  string[];
  /**
   * A short reason when an option must not be chosen, or undefined when it
   * may. One prop rather than two: an option is disabled exactly when there
   * is something to say about why, so the two can never disagree.
   */
  disabledReason?: (s: string) => string | undefined;
  /** Whole control, e.g. while a save is in flight. */
  disabled?: boolean;
}

/**
 * The status picker, shared by the order detail page and the order panel.
 *
 * Every option is the real badge — the same coloured chip the order shows
 * everywhere else — rather than plain text in a native menu, so the list can
 * be read at a glance and a status looks the same wherever it appears.
 */
export function StatusSelect({
  value,
  onChange,
  options = SETTABLE_STATUSES,
  disabledReason,
  disabled = false,
}: StatusSelectProps) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-border rounded-button bg-background hover:border-primary/40 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <OrderStatusBadge status={value} />
        <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-background border border-border/60 rounded-card shadow-floating p-1.5 animate-fade-in origin-top max-h-64 overflow-y-auto">
          {/* The current value is always listed, even when it is not on offer,
              so an order sitting on a status this picker cannot set still
              reads correctly instead of showing someone else's. */}
          {[...new Set([...options, value])].map((s) => {
            const reason = disabledReason?.(s);
            return (
            <button
              key={s}
              type="button"
              disabled={!!reason}
              title={reason}
              onClick={() => { onChange(s); setOpen(false); }}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-button transition-colors',
                s === value ? 'bg-primary/8' : reason ? '' : 'hover:bg-muted/8',
                reason ? 'cursor-not-allowed opacity-55' : '',
              ].join(' ')}
            >
              <OrderStatusBadge status={s} />
              {/* Says WHY, beside the badge. A greyed row with no
                  explanation reads as broken rather than as reserved. */}
              {reason && <span className="truncate text-xs text-muted">{reason}</span>}
              {s === value && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
