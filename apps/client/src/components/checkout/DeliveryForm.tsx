'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Truck, Clock, AlertTriangle } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ShippingEstimateDto } from '@ezihubb/types';
import { Skeleton } from '@ezihubb/ui';
import { fmtAmount } from '@ezihubb/utils';

interface DeliveryFormProps {
  countryCode:      string;
  onComplete:       (estimate: ShippingEstimateDto) => void;
  onBack:           () => void;
  /** True while page.tsx is creating the order after continuing */
  isCreatingOrder?: boolean;
}

function formatDeliveryRange(minDays: number, maxDays: number, locale: string): string {
  const from = new Date();
  from.setDate(from.getDate() + minDays);
  const to = new Date();
  to.setDate(to.getDate() + maxDays);

  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

/**
 * Etsy-parity — there is no buyer-facing shipping-method picker. Cost and
 * delivery timeline are resolved automatically from each seller's own
 * Delivery profile (see ShippingService.resolveSellerShippingCost()); this
 * just displays the resolved estimate and lets the shopper continue.
 */
export function DeliveryForm({
  countryCode,
  onComplete,
  onBack,
  isCreatingOrder = false,
}: DeliveryFormProps) {
  const t = useTranslations('checkout.deliveryForm');
  const locale = useLocale();
  const [estimate,  setEstimate]  = useState<ShippingEstimateDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError,   setIsError]   = useState(false);

  // Fetch the delivery estimate whenever the destination country changes
  useEffect(() => {
    if (!countryCode) return;

    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setEstimate(null);

    apiClient
      .post<ShippingEstimateDto>(API_ROUTES.CART.ESTIMATE_SHIPPING, { country: countryCode })
      .then((res) => {
        if (!cancelled) setEstimate(res);
      })
      .catch(() => {
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [countryCode]);

  const handleContinue = () => {
    if (estimate?.resolvable) onComplete(estimate);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted mb-4">
          {t.rich('calculating', { country: countryCode, b: (chunks) => <strong>{chunks}</strong> })}
        </p>
        <div className="border border-border rounded-card p-4 flex gap-3">
          <Skeleton variant="circle" width={20} height={20} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-40" />
            <Skeleton variant="text" className="w-56" />
          </div>
          <Skeleton variant="rect" className="w-12 h-5 rounded" />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError || estimate === null) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-error">{t('failedToLoad')}</p>
        <button
          type="button"
          onClick={() => { setIsError(false); setEstimate(null); }}
          className="text-sm text-primary hover:underline"
        >
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  // ── Unresolvable (a legacy listing predating the required Delivery profile) ─
  if (!estimate.resolvable) {
    return (
      <div className="py-8 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-warning mx-auto" />
        <p className="text-sm text-secondary font-medium">
          {t('unresolvable', { country: countryCode })}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-primary hover:underline"
        >
          {t('changeCountry')}
        </button>
      </div>
    );
  }

  const estDelivery = estimate.minDays != null && estimate.maxDays != null
    ? formatDeliveryRange(estimate.minDays, estimate.maxDays, locale)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-card border-2 border-primary bg-primary/5">
        <Truck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-secondary">{t('estimateTitle')}</p>
          {estDelivery && estimate.minDays != null && estimate.maxDays != null && (
            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {t('businessDays', { min: estimate.minDays, max: estimate.maxDays, date: estDelivery })}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {estimate.totalCost === 0 ? (
            <span className="text-sm font-bold text-success">{t('free')}</span>
          ) : (
            <span className="text-sm font-bold text-secondary">{fmtAmount(estimate.totalCost)}</span>
          )}
        </div>
      </div>

      {/* Navigation — desktop */}
      <div className="hidden md:flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreatingOrder}
          className="px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {t('back')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isCreatingOrder}
          className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isCreatingOrder ? t('creatingOrder') : t('continueToPayment')}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreatingOrder}
          className="w-12 h-12 border border-border rounded-button flex items-center justify-center text-secondary disabled:opacity-50"
          aria-label={t('backAria')}
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isCreatingOrder}
          className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {isCreatingOrder ? t('creating') : t('continueToPayment')}
        </button>
      </div>
    </div>
  );
}
