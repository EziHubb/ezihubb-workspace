'use client';

import React, { createContext, useCallback, useContext, useReducer } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label:   string;
  onClick: () => void;
}

export interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
  action?: ToastAction;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type ToastEvent =
  | { kind: 'ADD';    toast: ToastItem }
  | { kind: 'REMOVE'; id: string };

function reducer(state: ToastItem[], event: ToastEvent): ToastItem[] {
  switch (event.kind) {
    case 'ADD':    return [...state.slice(-2), event.toast]; // max 3
    case 'REMOVE': return state.filter((t) => t.id !== event.id);
    default:       return state;
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const ICON_CLASSES: Record<ToastType, string> = {
  success: 'text-success',
  error:   'text-error',
  warning: 'text-warning',
  info:    'text-primary',
};

const BORDER_CLASSES: Record<ToastType, string> = {
  success: 'border-success/30',
  error:   'border-error/30',
  warning: 'border-warning/30',
  info:    'border-primary/30',
};

// ── Context ───────────────────────────────────────────────────────────────────

export interface ToastContextValue {
  toast:   (message: string, type?: ToastType, action?: ToastAction) => void;
  success: (message: string, action?: ToastAction) => void;
  error:   (message: string, action?: ToastAction) => void;
  warning: (message: string, action?: ToastAction) => void;
  info:    (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  /** aria-label on each toast's dismiss button. Default: "Dismiss" */
  dismissLabel?: string;
}> = ({ children, dismissLabel = 'Dismiss' }) => {
  const [toasts, dispatch] = useReducer(reducer, []);

  const dismiss = useCallback((id: string) => dispatch({ kind: 'REMOVE', id }), []);

  const add = useCallback(
    (message: string, type: ToastType = 'info', action?: ToastAction) => {
      const id = Math.random().toString(36).slice(2);
      dispatch({ kind: 'ADD', toast: { id, type, message, action } });
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const ctx: ToastContextValue = {
    toast:   add,
    success: (msg, action) => add(msg, 'success', action),
    error:   (msg, action) => add(msg, 'error', action),
    warning: (msg, action) => add(msg, 'warning', action),
    info:    (msg, action) => add(msg, 'info', action),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        className={[
          'fixed z-[100] flex flex-col gap-2',
          'top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm',
          'md:left-auto md:right-4 md:translate-x-0 md:w-80',
        ].join(' ')}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={[
              'flex items-start gap-3 p-4 rounded-md border bg-surface shadow-floating animate-fade-in',
              BORDER_CLASSES[t.type],
            ].join(' ')}
          >
            <span className={`shrink-0 mt-0.5 ${ICON_CLASSES[t.type]}`}>
              {ICONS[t.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-secondary leading-snug">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label={dismissLabel}
              className="shrink-0 text-muted hover:text-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
