'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Copy, Check, ChevronDown } from 'lucide-react';

// ── Sentry integration — soft dependency ──────────────────────────────────────

function reportToSentry(error: Error) {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window === 'undefined') return;
  if (!process.env['NEXT_PUBLIC_SENTRY_DSN']) return;

  import(/* webpackIgnore: true */ '@sentry/nextjs' as string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((mod: any) => mod.captureException?.(error))
    .catch(() => undefined);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PageErrorProps {
  error:    Error & { digest?: string };
  reset:    () => void;
  homeHref?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageError({ error, reset, homeHref = '/' }: PageErrorProps) {
  const [copied,    setCopied]    = useState(false);
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    console.error('[PageError]', error);
    reportToSentry(error);
  }, [error]);

  const copyDigest = () => {
    if (!error.digest) return;
    navigator.clipboard.writeText(error.digest).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-16 text-center">
      {/* Illustration */}
      <div className="w-20 h-20 flex items-center justify-center mb-6">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <circle cx="40" cy="40" r="38" stroke="#E8E4DF" strokeWidth="2" />
          <path d="M28 28l24 24M52 28L28 52" stroke="#9CA3AF" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="40" cy="40" r="16" stroke="#9CA3AF" strokeWidth="2.5" />
        </svg>
      </div>

      <h2 className="font-display text-2xl font-bold text-secondary mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted max-w-xs mb-6">
        We&apos;ve been notified and are looking into it.
      </p>

      {/* Error ID */}
      {error.digest && (
        <div className="inline-flex items-center gap-2 bg-background border border-border rounded-sm px-3 py-2 mb-8">
          <span className="text-xs text-muted font-mono">Error ID:</span>
          <code className="font-mono text-xs text-secondary">{error.digest}</code>
          <button
            type="button"
            onClick={copyDigest}
            aria-label="Copy error ID"
            className="ml-1 text-muted hover:text-secondary transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-button transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <Link
          href={homeHref}
          className="inline-flex items-center justify-center px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
        >
          Go to Homepage
        </Link>
      </div>

      {/* Dev: collapsible stack trace */}
      {process.env.NODE_ENV === 'development' && error.message && (
        <div className="mt-8 w-full max-w-lg text-left">
          <button
            type="button"
            onClick={() => setShowStack((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStack ? 'rotate-180' : ''}`} />
            {showStack ? 'Hide' : 'Show'} error details
          </button>
          {showStack && (
            <pre className="mt-2 p-3 bg-background border border-border rounded-sm text-xs text-error overflow-x-auto whitespace-pre-wrap break-words">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
