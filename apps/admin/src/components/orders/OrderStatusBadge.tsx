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

export const ALL_STATUSES = Object.keys(STATUS_CONFIG);

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

export function StatusSelect({ value, onChange }: { value: string; onChange: (s: string) => void }) {
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
        className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-button bg-background hover:border-primary/40 transition-colors"
      >
        <OrderStatusBadge status={value} />
        <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-background border border-border/60 rounded-card shadow-floating p-1.5 animate-fade-in origin-top max-h-64 overflow-y-auto">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-button transition-colors',
                s === value ? 'bg-primary/8' : 'hover:bg-muted/8',
              ].join(' ')}
            >
              <OrderStatusBadge status={s} />
              {s === value && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
