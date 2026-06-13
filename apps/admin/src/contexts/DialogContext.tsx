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

function AppDialog({ state }: { state: NonNullable<DialogState> }) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [input,   setInput]   = useState(state.type === 'prompt' ? state.defaultValue : '');
  const [loading, setLoading] = useState(false);

  // Focus input on mount for prompt; focus confirm button for others
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.type === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (state.type !== 'preview') {
      confirmRef.current?.focus();
    }
  }, [state.type]);

  // Keyboard: Escape = cancel, Enter = confirm (except preview/prompt)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (state.type === 'confirm')  state.resolve(false);
        else if (state.type === 'prompt')   state.resolve(null);
        else if (state.type === 'alert')    state.resolve();
        else if (state.type === 'preview')  state.resolve();
      }
      if (e.key === 'Enter' && state.type === 'confirm') {
        state.resolve(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  const isPreview = state.type === 'preview';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => {
        if (state.type === 'confirm')  state.resolve(false);
        else if (state.type === 'prompt')   state.resolve(null);
        else if (state.type === 'alert')    state.resolve();
        else if (state.type === 'preview')  state.resolve();
      }}
    >
      <div
        className={`relative bg-card border border-border shadow-2xl rounded-xl flex flex-col ${
          isPreview ? 'w-[90vw] h-[85vh] max-w-6xl' : 'w-full max-w-md mx-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <DialogIcon type={state.type} />
            <span className="font-semibold text-sm">{state.title}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (state.type === 'confirm')  state.resolve(false);
              else if (state.type === 'prompt')   state.resolve(null);
              else if (state.type === 'alert')    state.resolve();
              else if (state.type === 'preview')  state.resolve();
            }}
            className="text-muted hover:text-secondary transition-colors rounded p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {isPreview ? (
          <div className="flex-1 min-h-0 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <iframe
              src={state.url}
              className="w-full h-full border-0 rounded-b-xl"
              title={state.title}
              onLoad={() => setLoading(false)}
              onLoadStart={() => setLoading(true)}
            />
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">{state.message}</p>

            {state.type === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={state.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    state.resolve(input.trim() || null);
                  }
                }}
                className="w-full text-sm border border-border rounded-button px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}

            <div className="flex gap-2.5 justify-end pt-1">
              {state.type !== 'alert' && (
                <button
                  type="button"
                  onClick={() => {
                    if (state.type === 'confirm') state.resolve(false);
                    else state.resolve(null);
                  }}
                  className="text-sm px-4 py-2 rounded-button border border-border text-secondary hover:bg-muted/30 transition-colors"
                >
                  Cancel
                </button>
              )}

              {state.type === 'alert' && (
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => state.resolve()}
                  className="text-sm px-5 py-2 rounded-button bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
                >
                  OK
                </button>
              )}

              {state.type === 'confirm' && (
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => state.resolve(true)}
                  className={`text-sm px-5 py-2 rounded-button font-medium transition-colors ${
                    state.destructive
                      ? 'bg-error text-white hover:bg-error/90'
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
                  className="text-sm px-5 py-2 rounded-button bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
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

function DialogIcon({ type }: { type: NonNullable<DialogState>['type'] }) {
  switch (type) {
    case 'alert':
      return <Info className="w-4 h-4 text-primary" />;
    case 'confirm':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'prompt':
      return <Info className="w-4 h-4 text-primary" />;
    case 'preview':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
}
