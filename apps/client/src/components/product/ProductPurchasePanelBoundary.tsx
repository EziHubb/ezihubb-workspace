'use client';

// A Server Component (page.tsx) can't pass a function as a prop across the
// RSC boundary — ErrorBoundary's `fallback` is a render-prop, so it can only
// be wired up from inside a Client Component. This is that wiring, kept in
// its own tiny file so page.tsx only needs to pass `children` (a plain
// element, which does cross the boundary fine).

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '../error/ErrorBoundary';

function Fallback({ retry }: { retry: () => void }) {
  const t = useTranslations('common');
  return (
    <div className="border border-border rounded-2xl p-6 text-center space-y-3">
      <p className="text-sm text-secondary font-medium">{t('error')}</p>
      <p className="text-xs text-muted">{t('weveBeenNotified')}</p>
      <button
        type="button"
        onClick={retry}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('retry')}
      </button>
    </div>
  );
}

export function ProductPurchasePanelBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={(retry) => <Fallback retry={retry} />}>
      {children}
    </ErrorBoundary>
  );
}
