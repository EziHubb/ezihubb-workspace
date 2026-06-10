'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ReloadButtonProps {
  /** Specific queryKey prefix to invalidate. If omitted, refetches all active queries. */
  queryKey?: unknown[];
  className?: string;
}

export function ReloadButton({ queryKey, className }: ReloadButtonProps) {
  const qc       = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const handleReload = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      if (queryKey) {
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
        'flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary/40 transition-colors bg-surface disabled:opacity-60',
        className ?? '',
      ].join(' ')}
    >
      <RefreshCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Reload</span>
    </button>
  );
}
