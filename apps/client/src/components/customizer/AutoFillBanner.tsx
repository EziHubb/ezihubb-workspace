'use client';

import React, { useEffect, useState } from 'react';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { API_ROUTES } from '@mlh/constants';
import { apiClient } from '../../lib/api-client';
import type { FieldValue } from '../../lib/customizer/types';

interface AutoFillBannerProps {
  isLoggedIn: boolean;
}

export function AutoFillBanner({ isLoggedIn }: AutoFillBannerProps) {
  const productId = useCustomizerStore((s) => s.productId);
  const autoFill  = useCustomizerStore((s) => s.autoFill);

  const [savedData, setSavedData]   = useState<Record<string, FieldValue> | null>(null);
  const [dismissed, setDismissed]   = useState(false);
  const [applied, setApplied]       = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !productId) return;

    const controller = new AbortController();

    apiClient
      .get<{ data?: { fields?: Record<string, FieldValue> } }>(
        API_ROUTES.CUSTOMIZATION.LAST(productId),
        { signal: controller.signal },
      )
      .then((draft) => {
        if (draft?.data?.fields && Object.keys(draft.data.fields).length > 0) {
          setSavedData(draft.data.fields);
        }
      })
      .catch(() => { /* non-critical */ });

    return () => controller.abort();
  }, [isLoggedIn, productId]);

  if (!savedData || dismissed || applied) return null;

  const handleApply = () => {
    autoFill(savedData);
    setApplied(true);
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/20 mb-4">
      <div className="shrink-0 mt-0.5 text-primary">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary">We saved your previous customization</p>
        <p className="text-xs text-muted mt-0.5">Want to start from where you left off?</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleApply}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Yes, auto-fill
          </button>
          <span className="text-muted text-xs">·</span>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted hover:text-secondary"
          >
            Start fresh
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted hover:text-secondary"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
