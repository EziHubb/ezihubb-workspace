'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { X, AlertTriangle, Info, CheckCircle, Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertOptions   { title?: string; variant?: 'info' | 'error' }
export interface ConfirmOptions { title?: string; confirmLabel?: string; destructive?: boolean }
export interface PromptOptions  { title?: string; placeholder?: string; defaultValue?: string }

type DialogState =
  | { type: 'alert';   title: string; message: string; variant: 'info' | 'error';                resolve: () => void }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; destructive: boolean; resolve: (ok: boolean) => void }
  | { type: 'prompt';  title: string; message: string; placeholder: string; defaultValue: string; resolve: (val: string | null) => void }
  | { type: 'preview'; title: string; url: string;                                               resolve: () => void }
  | null;

interface DialogContextValue {
  alert:   (message: string, opts?: AlertOptions)   => Promise<void>;
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  prompt:  (message: string, opts?: PromptOptions)  => Promise<string | null>;
  preview: (url: string, title?: string)            => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const alert = useCallback((message: string, opts: AlertOptions = {}): Promise<void> => {
    return new Promise((resolve) => {
      setState({
        type: 'alert',
        title:   opts.title ?? (opts.variant === 'error' ? 'Error' : 'Notice'),
        variant: opts.variant ?? 'info',
        message,
        resolve: () => { setState(null); resolve(); },
      });
    });
  }, []);

  const confirm = useCallback((message: string, opts: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        type:         'confirm',
        title:        opts.title        ?? 'Confirm',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        destructive:  opts.destructive  ?? false,
        message,
        resolve: (ok) => { setState(null); resolve(ok); },
      });
    });
  }, []);

  const prompt = useCallback((message: string, opts: PromptOptions = {}): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({
        type:         'prompt',
        title:        opts.title        ?? 'Input required',
        placeholder:  opts.placeholder  ?? '',
        defaultValue: opts.defaultValue ?? '',
        message,
        resolve: (val) => { setState(null); resolve(val); },
      });
    });
  }, []);

  const preview = useCallback((url: string, title = 'Preview'): Promise<void> => {
    return new Promise((resolve) => {
      setState({
        type:  'preview',
        title,
        url,
        resolve: () => { setState(null); resolve(); },
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, preview }}>
      {children}
      {state && <AppDialog state={state} />}
    </DialogContext.Provider>
  );
}

// ── Dialog renderer ───────────────────────────────────────────────────────────

function dismiss(state: NonNullable<DialogState>) {
  if (state.type === 'confirm') state.resolve(false);
  else if (state.type === 'prompt') state.resolve(null);
  else if (state.type === 'alert') state.resolve();
  else if (state.type === 'preview') state.resolve();
}

function AppDialog({ state }: { state: NonNullable<DialogState> }) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [input,   setInput]   = useState(state.type === 'prompt' ? state.defaultValue : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.type === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (state.type !== 'preview') {
      confirmRef.current?.focus();
    }
  }, [state.type]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss(state);
      if (e.key === 'Enter' && state.type === 'confirm') state.resolve(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  const isPreview = state.type === 'preview';

  return (
    <>
      <style>{`
        @keyframes dlg-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dlg-card-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      {/* Overlay — no backdropFilter to avoid blurring dialog text */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(10,10,20,0.5)', animation: 'dlg-overlay-in 0.15s ease both' }}
        onClick={() => dismiss(state)}
      >
        {/* Card */}
        <div
          className={`relative bg-surface border border-border flex flex-col
            ${isPreview
              ? 'w-[92vw] h-[88vh] max-w-6xl rounded-xl shadow-2xl'
              : 'w-full max-w-sm rounded-xl shadow-floating'
            }`}
          style={{ animation: 'dlg-card-in 0.2s ease both' }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Preview ── */}
          {isPreview ? (
            <>
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border shrink-0">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="font-semibold text-sm text-secondary pr-8 truncate">{state.title}</span>
                <button type="button" onClick={() => dismiss(state)}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-secondary hover:bg-muted/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 relative rounded-b-xl overflow-hidden">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                <iframe src={state.url} className="w-full h-full border-0" title={state.title}
                  onLoad={() => setLoading(false)} onLoadStart={() => setLoading(true)} />
              </div>
            </>
          ) : (
            /* ── Alert / Confirm / Prompt ── */
            <>
              {/* Close X */}
              <button
                type="button"
                onClick={() => dismiss(state)}
                className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-secondary hover:bg-black/5 transition-colors"
                aria-label="Close"
              >
                <X className="w-[15px] h-[15px]" />
              </button>

              {/* Body */}
              <div className="px-6 pt-8 pb-5 flex flex-col items-center gap-3">
                <DialogIconBadge state={state} />

                <h2 className="text-[15px] font-semibold leading-snug text-center" style={{ color: '#1C1C1E' }}>
                  {state.title}
                </h2>

                <p className="text-sm leading-relaxed text-center" style={{ color: '#555560' }}>
                  {state.message}
                </p>

                {state.type === 'prompt' && (
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={state.placeholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); state.resolve(input.trim() || null); }
                    }}
                    className="w-full mt-1 text-sm border border-border rounded-lg px-3.5 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-shadow"
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-2.5 justify-end">
                {state.type !== 'alert' && (
                  <button
                    type="button"
                    onClick={() => { if (state.type === 'confirm') state.resolve(false); else state.resolve(null); }}
                    className="h-9 px-5 rounded-lg border border-border text-sm font-medium bg-transparent transition-colors"
                    style={{ color: '#2D2D2D' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0efed'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    Cancel
                  </button>
                )}

                {state.type === 'alert' && (
                  <button ref={confirmRef} type="button" onClick={() => state.resolve()}
                    className="h-9 px-8 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all shadow-sm">
                    OK
                  </button>
                )}

                {state.type === 'confirm' && (
                  <button
                    ref={confirmRef}
                    type="button"
                    onClick={() => state.resolve(true)}
                    className={`h-9 px-5 rounded-lg text-sm font-semibold text-white active:scale-[0.98] transition-all shadow-sm ${
                      state.destructive ? 'bg-error hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'
                    }`}
                  >
                    {state.confirmLabel}
                  </button>
                )}

                {state.type === 'prompt' && (
                  <button ref={confirmRef} type="button" onClick={() => state.resolve(input.trim() || null)}
                    className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all shadow-sm">
                    Submit
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function DialogIconBadge({ state }: { state: NonNullable<DialogState> }) {
  const isDestructive = state.type === 'confirm' && state.destructive;
  const isErrorAlert  = state.type === 'alert' && state.variant === 'error';

  const bg =
    isDestructive || isErrorAlert ? 'bg-red-500/10'
    : state.type === 'confirm'    ? 'bg-amber-500/10'
    :                                'bg-primary/10';

  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
      {isDestructive || isErrorAlert ? <AlertTriangle className="w-6 h-6 text-red-500" />    :
       state.type === 'confirm'      ? <AlertTriangle className="w-6 h-6 text-amber-500" /> :
                                        <Info           className="w-6 h-6 text-primary"   />
      }
    </div>
  );
}
