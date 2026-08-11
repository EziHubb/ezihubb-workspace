'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToasts, toast as toastApi } from '../../lib/store/toast.store';
import type { ToastItem, ToastType } from '../../lib/store/toast.store';

// ── Per-type styles ───────────────────────────────────────────────────────────

const TYPE_STYLES: Record<ToastType, {
  icon:   React.ReactNode;
  bar:    string;
  border: string;
}> = {
  success: {
    icon:   <CheckCircle  className="w-5 h-5 text-success shrink-0" />,
    bar:    'bg-success',
    border: 'border-l-success',
  },
  error: {
    icon:   <XCircle      className="w-5 h-5 text-error shrink-0" />,
    bar:    'bg-error',
    border: 'border-l-error',
  },
  warning: {
    icon:   <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    bar:    'bg-warning',
    border: 'border-l-warning',
  },
  info: {
    icon:   <Info          className="w-5 h-5 text-primary shrink-0" />,
    bar:    'bg-primary',
    border: 'border-l-primary',
  },
};

// ── Single toast item ─────────────────────────────────────────────────────────

function Toast({ t }: { t: ToastItem }) {
  const [progress, setProgress] = useState(100);
  const [paused,   setPaused]   = useState(false);
  const elapsed  = useRef(0);
  const styles   = TYPE_STYLES[t.type];

  // Auto-dismiss with progress bar. Keyed on t.createdAt too — a repeat of the
  // same error while this toast is still visible bumps createdAt (see
  // toast.store.ts's dedupe in addToast) instead of stacking a duplicate,
  // which should refresh the timer rather than let it die on the original schedule.
  useEffect(() => {
    const step = 50; // ms per tick
    elapsed.current = 0;

    const tick = () => {
      if (paused) return;
      elapsed.current += step;
      const pct = Math.max(0, 100 - (elapsed.current / t.duration) * 100);
      setProgress(pct);
      if (elapsed.current >= t.duration) {
        toastApi.dismiss(t.id);
      }
    };

    const id = setInterval(tick, step);
    return () => clearInterval(id);
  }, [t.id, t.duration, t.createdAt, paused]);

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={[
        'relative overflow-hidden flex items-start gap-3 p-4',
        'bg-white rounded-md border border-border border-l-4 shadow-lg',
        'animate-fadeIn',
        styles.border,
      ].join(' ')}
    >
      <span className="mt-0.5">{styles.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary leading-snug">{t.message}</p>
        {t.description && (
          <p className="text-xs text-muted mt-0.5">{t.description}</p>
        )}
        {t.action && (
          <button
            type="button"
            onClick={() => { t.action!.onClick(); toastApi.dismiss(t.id); }}
            className="mt-1 text-xs font-semibold text-primary hover:underline"
          >
            {t.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => toastApi.dismiss(t.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted hover:text-secondary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-border/30 w-full">
        <div
          className={`h-full transition-none ${styles.bar} opacity-40`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className={[
        'fixed z-[100] flex flex-col gap-2 pointer-events-none',
        // Mobile: top-center
        'top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm',
        // Desktop: top-right
        'md:left-auto md:right-4 md:translate-x-0 md:w-80',
      ].join(' ')}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast t={t} />
        </div>
      ))}
    </div>
  );
}
