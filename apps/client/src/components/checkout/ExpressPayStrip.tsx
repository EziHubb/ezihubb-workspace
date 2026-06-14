'use client';

import { useState } from 'react';

interface ExpressPayStripProps {
  /** Cart total in USD for display */
  total:    number;
  /** Called when user taps an express button — receives which provider was chosen */
  onSelect?: (provider: 'apple' | 'google' | 'paypal') => void;
}

export function ExpressPayStrip({ total, onSelect }: ExpressPayStripProps) {
  const [loading, setLoading] = useState<'apple' | 'google' | 'paypal' | null>(null);

  const handleClick = async (provider: 'apple' | 'google' | 'paypal') => {
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

      <div className="grid grid-cols-3 gap-2">
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

        {/* Google Pay */}
        <button
          type="button"
          onClick={() => handleClick('google')}
          disabled={loading !== null}
          aria-label="Pay with Google Pay"
          className={[
            'flex items-center justify-center h-12 rounded-lg border transition-all',
            'bg-white text-secondary border-border hover:bg-muted/10 active:scale-[0.98]',
            loading === 'google' ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {loading === 'google' ? (
            <span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-xs font-bold tracking-tight">
              <span style={{ color: '#4285F4' }}>G</span>
              <span style={{ color: '#EA4335' }}>o</span>
              <span style={{ color: '#FBBC05' }}>o</span>
              <span style={{ color: '#4285F4' }}>g</span>
              <span style={{ color: '#34A853' }}>l</span>
              <span style={{ color: '#EA4335' }}>e</span>
              <span className="text-secondary ml-0.5">Pay</span>
            </span>
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
