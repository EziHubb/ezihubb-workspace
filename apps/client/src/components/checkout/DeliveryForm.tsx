'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Truck, Clock } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import type { ShippingOptionDto } from '@ezihubb/types';
import { Skeleton } from '@ezihubb/ui';
import { fmtAmount, safeArr } from '@ezihubb/utils';

interface DeliveryFormProps {
  countryCode:      string;
  orderTotal:       number;
  onComplete:       (method: ShippingOptionDto) => void;
  onBack:           () => void;
  /** True while page.tsx is creating the order after method selection */
  isCreatingOrder?: boolean;
}

function formatDelivery(opt: ShippingOptionDto, locale: string): string {
  const from = new Date();
  from.setDate(from.getDate() + opt.minDays);
  const to = new Date();
  to.setDate(to.getDate() + opt.maxDays);

  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

export function DeliveryForm({
  countryCode,
  orderTotal,
  onComplete,
  onBack,
  isCreatingOrder = false,
}: DeliveryFormProps) {
  const t = useTranslations('checkout.deliveryForm');
  const locale = useLocale();
  const [selected,  setSelected]  = useState<string>('');
  const [options,   setOptions]   = useState<ShippingOptionDto[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError,   setIsError]   = useState(false);

  // Fetch shipping options whenever country or order total changes
  useEffect(() => {
    if (!countryCode) return;

    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setOptions(null);
    setSelected('');

    apiClient
      .post<ShippingOptionDto[]>('/shipping/calculate', {
        countryCode,
        orderTotal,
      })
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [countryCode, orderTotal]);

  const handleContinue = () => {
    const method = options?.find((o) => o.methodId === selected);
    if (method) onComplete(method);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted mb-4">
          {t.rich('calculating', { country: countryCode, b: (chunks) => <strong>{chunks}</strong> })}
        </p>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border rounded-card p-4 flex gap-3">
            <Skeleton variant="circle" width={20} height={20} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-40" />
              <Skeleton variant="text" className="w-56" />
            </div>
            <Skeleton variant="rect" className="w-12 h-5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError || options === null) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-error">{t('failedToLoad')}</p>
        <button
          type="button"
          onClick={() => { setIsError(false); setOptions(null); }}
          className="text-sm text-primary hover:underline"
        >
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  // ── No options available ───────────────────────────────────────────────────
  if (safeArr(options).length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <Truck className="w-10 h-10 text-muted mx-auto" />
        <p className="text-sm text-secondary font-medium">
          {t('noShipTo', { country: countryCode })}
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

  return (
    <div className="space-y-5">
      {/* Radio cards */}
      <fieldset>
        <legend className="text-sm font-semibold text-secondary mb-3">
          {t('selectMethod')}
        </legend>

        <div className="space-y-3" role="radiogroup" aria-label={t('methodsAria')}>
          {safeArr(options).map((opt) => {
            const isActive = selected === opt.methodId;
            const estDelivery = formatDelivery(opt, locale);

            return (
              <label
                key={opt.methodId}
                className={[
                  'flex items-start gap-3 p-4 rounded-card border-2 cursor-pointer transition-all',
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={opt.methodId}
                  checked={isActive}
                  onChange={() => setSelected(opt.methodId)}
                  className="mt-0.5 accent-primary w-4 h-4 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-secondary">
                        {opt.name}
                        {opt.carrier && (
                          <span className="text-muted font-normal ml-1.5">
                            {t('via', { carrier: opt.carrier })}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {t('businessDays', { min: opt.minDays, max: opt.maxDays, date: estDelivery })}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {opt.isFree ? (
                        <span className="text-sm font-bold text-success">{t('free')}</span>
                      ) : opt.freeShippingOver !== undefined ? (
                        <div className="text-right">
                          <p className="text-sm font-bold text-secondary">
                            {fmtAmount(opt.price)}
                          </p>
                          <p className="text-[10px] text-muted">
                            {t('freeOver', { amount: fmtAmount(opt.freeShippingOver) })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-secondary">
                          {fmtAmount(opt.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

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
          disabled={!selected || isCreatingOrder}
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
          disabled={!selected || isCreatingOrder}
          className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {isCreatingOrder ? t('creating') : t('continueToPayment')}
        </button>
      </div>
    </div>
  );
}
