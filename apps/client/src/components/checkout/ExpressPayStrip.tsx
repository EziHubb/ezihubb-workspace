'use client';

import { useState } from 'react';

interface ExpressPayStripProps {
  total:     number;
  onSelect?: () => void;
}

export function ExpressPayStrip({ total, onSelect }: ExpressPayStripProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      onSelect?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted font-medium uppercase tracking-wide whitespace-nowrap">
          Express checkout
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label="Pay with PayPal"
        className={[
          'w-full flex items-center justify-center h-12 rounded-lg border transition-all',
          'bg-[#FFC439] text-[#003087] border-[#FFC439] hover:brightness-110 active:scale-[0.98]',
          loading ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-[#003087] border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="font-bold text-sm tracking-tight text-[#003087]">
            Pay<span style={{ color: '#009cde' }}>Pal</span>
          </span>
        )}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">or pay with card</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <p className="text-center text-[10px] text-muted tabular-nums">
        Total: ${total.toFixed(2)} USD
      </p>
    </div>
  );
}
