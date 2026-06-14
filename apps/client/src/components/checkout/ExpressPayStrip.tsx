'use client';

import { useState } from 'react';

interface ExpressPayStripProps {
  /** Cart total in USD for display */
  total:    number;
  /** Called when user taps an express button — receives which provider was chosen */
  onSelect?: (provider: 'apple' | 'paypal') => void;
}

export function ExpressPayStrip({ total, onSelect }: ExpressPayStripProps) {
  const [loading, setLoading] = useState<'apple' | 'paypal' | null>(null);

  const handleClick = async (provider: 'apple' | 'paypal') => {
    setLoading(provider);
    try {
      onSelect?.(provider);
    } finally {
      setLoading(null);
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

      <div className="grid grid-cols-2 gap-2">
        {/* Apple Pay */}
        <button
          type="button"
          onClick={() => handleClick('apple')}
          disabled={loading !== null}
          aria-label="Pay with Apple Pay"
          className={[
            'flex items-center justify-center h-12 rounded-lg border transition-all',
            'bg-black text-white border-black hover:opacity-90 active:scale-[0.98]',
            loading === 'apple' ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {loading === 'apple' ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 48 16" fill="white" className="h-4 w-auto" aria-hidden>
              <text x="0" y="13" fontFamily="system-ui,-apple-system,BlinkMacSystemFont" fontWeight="500" fontSize="14">
                 Pay
              </text>
            </svg>
          )}
        </button>

        {/* PayPal */}
        <button
          type="button"
          onClick={() => handleClick('paypal')}
          disabled={loading !== null}
          aria-label="Pay with PayPal"
          className={[
            'flex items-center justify-center h-12 rounded-lg border transition-all',
            'bg-[#FFC439] text-[#003087] border-[#FFC439] hover:brightness-110 active:scale-[0.98]',
            loading === 'paypal' ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {loading === 'paypal' ? (
            <span className="w-4 h-4 border-2 border-[#003087] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="font-bold text-sm tracking-tight text-[#003087]">
              Pay<span style={{ color: '#009cde' }}>Pal</span>
            </span>
          )}
        </button>
      </div>

      {/* Divider below */}
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
