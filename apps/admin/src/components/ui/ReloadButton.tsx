'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ReloadButtonProps {
  /** Specific queryKey prefix to invalidate. If omitted, refetches all active queries. */
  queryKey?: unknown[];
  queryKeys?: unknown[][];
  className?: string;
}

export function ReloadButton({ queryKey, queryKeys, className }: ReloadButtonProps) {
  const qc       = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const handleReload = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      if (queryKeys) {
        await Promise.all(queryKeys.map(key => qc.refetchQueries({ queryKey: key, type: 'active' })));
      } else if (queryKey) {
        await qc.refetchQueries({ queryKey, type: 'active' });
      } else {
        await qc.refetchQueries({ type: 'active' });
      }
    } finally {
      // Keep spinner visible for at least 600ms so it's noticeable
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReload}
      disabled={spinning}
      aria-label="Reload data"
      title="Reload data"
      className={[
        'flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-pill px-3.5 py-1.5 hover:border-secondary/40 transition-colors bg-surface disabled:opacity-60',
        className ?? '',
      ].join(' ')}
    >
      <RefreshCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Reload</span>
    </button>
  );
}
