'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

// ── Sentry integration — soft dependency, mirrors PageError.tsx ───────────────

function reportToSentry(error: Error) {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window === 'undefined') return;
  if (!process.env['NEXT_PUBLIC_SENTRY_DSN']) return;

  import(/* webpackIgnore: true */ '@sentry/nextjs' as string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((mod: any) => mod.captureException?.(error))
    .catch(() => undefined);
}

// ── Props / state ─────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of children once a descendant throws. `retry` clears the
   *  boundary and re-renders children fresh — a hydration-timing mismatch that
   *  crashed once often succeeds on the very next render. */
  fallback: (retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
// Route-level error.tsx (apps/client/src/app/[locale]/(storefront)/error.tsx)
// only catches errors that escape the ENTIRE page — a throw partway through one
// section (e.g. a hydration mismatch inside just the purchase panel) doesn't
// reach it. Left uncaught, React unmounts everything from the crash point down
// with nothing rendered in its place: no error, no fallback, just silent blank
// space — indistinguishable from "the rest of the page never had content" to
// whoever's looking at it. Wrap a section in this instead of leaving it bare.

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportToSentry(error);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(() => this.setState({ error: null }));
    }
    return this.props.children;
  }
}
