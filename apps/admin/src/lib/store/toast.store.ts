import { useSyncExternalStore } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /**
   * Show this person instead of the type glyph.
   *
   * A message from a customer arriving under a generic info icon says only
   * "something happened". Their face says who, which is the part the seller
   * acts on. `avatarName` drives the initials fallback, because most accounts
   * have no picture and a blank circle is worse than two letters.
   */
  avatarUrl?:   string | null;
  avatarName?:  string;
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
  // A page that fires several independent queries can have more than one fail
  // for the same underlying reason at nearly the same time (e.g. a stats query
  // and a list query both hitting the same broken endpoint) — without this,
  // each failure stacks its own toast even though they're the same message.
  const duplicate = _toasts.find((t) => t.type === type && t.message === message);
  if (duplicate) {
    // useSyncExternalStore compares snapshots by reference (Object.is) — mutating
    // the existing toast in place would leave `_toasts` pointing at the same
    // array, so React would never re-render and the refreshed timer below would
    // silently never take effect. Replace both the array and the toast object.
    const refreshed: ToastItem = { ...duplicate, createdAt: Date.now() };
    _toasts = _toasts.map((t) => (t.id === duplicate.id ? refreshed : t));
    notify();
    return duplicate.id;
  }

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

// ── Module-level API (usable outside React — e.g. React Query's global onError) ─

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
