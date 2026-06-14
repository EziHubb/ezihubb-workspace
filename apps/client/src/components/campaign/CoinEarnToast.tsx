'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface CoinEarnToastProps {
  coins:        number;
  description?: string;
  onDismiss?:   () => void;
  /** When true the toast renders inline (no fixed positioning) */
  inline?:      boolean;
}

export function CoinEarnToast({
  coins,
  description = 'from purchase',
  onDismiss,
  inline = false,
}: CoinEarnToastProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 80);
    const t2 = setTimeout(() => dismiss(), 4_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 300);
  };

  const wrapCls = inline
    ? 'relative'
    : [
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]',
        'transition-all duration-300',
        visible && !leaving ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      ].join(' ');

  return (
    <div className={wrapCls} style={{ maxWidth: 340 }}>
      <div className="flex items-center gap-3 bg-[#1A1A1A] text-white rounded-2xl px-5 py-3.5 shadow-2xl w-full">
        <span
          className="text-2xl shrink-0"
          style={{ animation: 'spin 0.6s ease-out 1' }}
          aria-hidden
        >
          🪙
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">+{coins} BuyCoins earned!</p>
          <p className="text-xs text-white/60">{description}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-white/40 hover:text-white transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
