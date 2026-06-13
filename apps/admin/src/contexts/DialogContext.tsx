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

export interface AlertOptions   { title?: string }
export interface ConfirmOptions { title?: string; confirmLabel?: string; destructive?: boolean }
export interface PromptOptions  { title?: string; placeholder?: string; defaultValue?: string }

type DialogState =
  | { type: 'alert';   title: string; message: string;                                           resolve: () => void }
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
        title:   opts.title ?? 'Notice',
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
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-0"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => dismiss(state)}
    >
      <div
        className={`relative bg-card border border-border/60 shadow-2xl flex flex-col overflow-hidden
          ${isPreview
            ? 'w-[92vw] h-[88vh] max-w-6xl rounded-2xl'
            : 'w-full max-w-[400px] rounded-2xl sm:mx-4'
          }`}
        style={{
          animation: 'dlg-in 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes dlg-in {
            from { opacity: 0; transform: scale(0.92) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }
        `}</style>

        {/* Close button — top-right corner */}
        <button
          type="button"
          onClick={() => dismiss(state)}
          className="absolute top-3.5 right-3.5 z-10 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-secondary hover:bg-muted/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Preview iframe */}
        {isPreview ? (
          <>
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <span className="font-semibold text-sm text-secondary truncate pr-8">{state.title}</span>
            </div>
            <div className="flex-1 min-h-0 relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              <iframe
                src={state.url}
                className="w-full h-full border-0"
                title={state.title}
                onLoad={() => setLoading(false)}
                onLoadStart={() => setLoading(true)}
              />
            </div>
          </>
        ) : (
          /* Alert / Confirm / Prompt */
          <div className="px-6 pt-7 pb-6 flex flex-col gap-5">
            {/* Icon + Title */}
            <div className="flex flex-col items-center gap-3 text-center">
              <DialogIconBadge state={state} />
              <h2 className="text-base font-semibold text-secondary leading-snug">
                {state.title}
              </h2>
            </div>

            {/* Message */}
            <p className="text-sm text-muted text-center leading-relaxed -mt-1">
              {state.message}
            </p>

            {/* Prompt input */}
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
                className="w-full text-sm border border-border rounded-lg px-3.5 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
              />
            )}

            {/* Buttons */}
            <div className={`flex gap-2.5 ${state.type === 'alert' ? 'justify-center' : 'justify-end'} pt-1`}>
              {state.type !== 'alert' && (
                <button
                  type="button"
                  onClick={() => {
                    if (state.type === 'confirm') state.resolve(false);
                    else state.resolve(null);
                  }}
                  className="h-9 px-5 rounded-lg border border-border text-sm font-medium text-secondary bg-transparent hover:bg-muted/10 transition-colors"
                >
                  Cancel
                </button>
              )}

              {state.type === 'alert' && (
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => state.resolve()}
                  className="h-9 px-8 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
                >
                  OK
                </button>
              )}

              {state.type === 'confirm' && (
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => state.resolve(true)}
                  className={`h-9 px-5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm ${
                    state.destructive
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {state.confirmLabel}
                </button>
              )}

              {state.type === 'prompt' && (
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => state.resolve(input.trim() || null)}
                  className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DialogIconBadge({ state }: { state: NonNullable<DialogState> }) {
  const isDestructive = state.type === 'confirm' && state.destructive;

  const bg =
    isDestructive                ? 'bg-red-500/10'
    : state.type === 'confirm'   ? 'bg-amber-500/10'
    : state.type === 'alert'     ? 'bg-primary/10'
    :                              'bg-primary/10';

  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
      {isDestructive       ? <AlertTriangle className="w-6 h-6 text-red-500" />    :
       state.type === 'confirm' ? <AlertTriangle className="w-6 h-6 text-amber-500" /> :
       state.type === 'alert'   ? <Info           className="w-6 h-6 text-primary"   /> :
                                  <Info           className="w-6 h-6 text-primary"   />
      }
    </div>
  );
}
