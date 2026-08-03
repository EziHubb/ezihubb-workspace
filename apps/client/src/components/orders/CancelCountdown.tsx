'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@ezihubb/ui';

interface Props {
  confirmedAt: string;
  onCancel:    () => void;
  isLoading?:  boolean;
}

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CancelCountdown({ confirmedAt, onCancel, isLoading }: Props) {
  const deadline = new Date(confirmedAt).getTime() + CANCEL_WINDOW_MS;

  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const r = deadline - Date.now();
      setRemaining(r);
      if (r <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (remaining <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        className="border-error text-error hover:bg-red-50 focus-visible:ring-error/30"
        onClick={onCancel}
        loading={isLoading}
        leftIcon={<AlertTriangle />}
      >
        Cancel Order
      </Button>
      <span className="text-xs text-muted">
        <span className="font-mono font-semibold text-error">
          {formatCountdown(remaining)}
        </span>
        {' '}remaining to cancel
      </span>
    </div>
  );
}
