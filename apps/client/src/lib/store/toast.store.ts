import { useSyncExternalStore } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  duration?:    number;
  description?: string;
  action?: {
    label:   string;
    onClick: () => void;
  };
}

export interface ToastItem extends ToastOptions {
  id:        string;
  type:      ToastType;
  message:   string;
  duration:  number;
  createdAt: number;
}

// ── Module-level state (singleton) ────────────────────────────────────────────

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info:    4000,
  warning: 5000,
  error:   6000,
};

let _toasts: ToastItem[]  = [];
let _listeners: (() => void)[] = [];

function notify() {
  for (const fn of _listeners) fn();
}

function addToast(type: ToastType, message: string, options: ToastOptions = {}): string {
  const id       = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const duration = options.duration ?? DEFAULT_DURATION[type];

  // max 3 toasts — drop oldest first
  _toasts = [..._toasts.slice(-2), {
    id,
    type,
    message,
    description: options.description,
    action:      options.action,
    duration,
    createdAt:   Date.now(),
  }];

  notify();
  return id;
}

function dismissToast(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  notify();
}

function dismissAll() {
  _toasts = [];
  notify();
}

// ── Module-level API (usable outside React) ───────────────────────────────────

export const toast = {
  success:    (msg: string, opts?: ToastOptions) => addToast('success', msg, opts),
  error:      (msg: string, opts?: ToastOptions) => addToast('error',   msg, opts),
  warning:    (msg: string, opts?: ToastOptions) => addToast('warning', msg, opts),
  info:       (msg: string, opts?: ToastOptions) => addToast('info',    msg, opts),
  dismiss:    dismissToast,
  dismissAll,
};

// ── useSyncExternalStore subscription ────────────────────────────────────────

function subscribe(cb: () => void): () => void {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter((l) => l !== cb); };
}

function getSnapshot():    readonly ToastItem[] { return _toasts; }
function getServerSnapshot(): readonly ToastItem[] { return []; }

/** React hook — subscribes to the module-level store. */
export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
