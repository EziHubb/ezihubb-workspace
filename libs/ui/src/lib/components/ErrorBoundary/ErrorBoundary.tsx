'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Shown when the caught error has no message. Default: "Something went wrong." */
  fallbackMessage?: string;
  /** Retry button label. Default: "Try again" */
  retryLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback != null) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-muted mb-3">
            {this.state.error?.message ?? this.props.fallbackMessage ?? 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="text-sm text-primary underline underline-offset-2 hover:no-underline"
          >
            {this.props.retryLabel ?? 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
