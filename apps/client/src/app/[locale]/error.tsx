'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const locale = useLocale();
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    // Structured logging in all environments
    console.error('[Error Boundary]', error);

    // Dynamic Sentry reporting — no hard dependency; silent if not installed
    if (typeof window !== 'undefined' && process.env['NEXT_PUBLIC_SENTRY_DSN']) {
      import(/* webpackIgnore: true */ '@sentry/nextjs' as string)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((mod: any) => mod.captureException?.(error))
        .catch(() => undefined);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16 text-center bg-background">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-error" aria-hidden="true" />
      </div>

      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-3">
        {t('somethingWentWrongTitle')}
      </h1>
      <p className="text-muted text-base max-w-sm mb-6">
        {t('unexpectedErrorDesc')}
      </p>

      {/* Error ID for support reference */}
      {error.digest && (
        <div className="bg-background border border-border rounded-sm px-4 py-2 mb-8 inline-flex items-center gap-2">
          <span className="text-xs text-muted">{tCommon('errorId')}</span>
          <code className="font-mono text-xs text-secondary">{error.digest}</code>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          <RefreshCw className="w-4 h-4" />
          {tCommon('retry')}
        </button>
        <Link
          href={`/${locale}/pages/contact`}
          className="inline-flex items-center justify-center gap-2 border border-border text-secondary font-semibold px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          {t('contactSupport')}
        </Link>
      </div>

      <Link
        href={`/${locale}`}
        className="text-sm text-primary hover:underline underline-offset-2"
      >
        {t('returnHome')}
      </Link>
    </div>
  );
}
