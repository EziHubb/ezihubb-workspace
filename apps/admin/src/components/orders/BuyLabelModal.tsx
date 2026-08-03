'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Check, CreditCard } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface ShippingRate {
  id:           string;
  carrier:      string;
  service:      string;
  price:        number;
  deliveryDays?: number;
  currency:     string;
}

export interface LabelPurchaseResult {
  labelUrl:       string;
  trackingNumber: string;
  trackingUrl:    string;
  carrier:        string;
  cost:           number;
}

interface Props {
  orderId:          string;
  shippingName:     string;
  shippingCity:     string;
  shippingState?:   string;
  shippingCountry:  string;
  isOpen:           boolean;
  onClose:          () => void;
  onLabelPurchased: (result: LabelPurchaseResult) => void;
}

export function BuyLabelModal({
  orderId, shippingName, shippingCity, shippingState, shippingCountry,
  isOpen, onClose, onLabelPurchased,
}: Props) {
  const [rates,          setRates]          = useState<ShippingRate[]>([]);
  const [selectedRate,   setSelectedRate]   = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isPurchasing,   setIsPurchasing]   = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setRates([]);
    setSelectedRate(null);
    setIsLoadingRates(true);
    api.get<ShippingRate[]>(API_ROUTES.ADMIN.ORDER_RATES(orderId))
      .then((data) => {
        setRates(data);
        if (data.length > 0) setSelectedRate(data[0].id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoadingRates(false));
  }, [isOpen, orderId]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  const handlePurchase = async () => {
    if (!selectedRate) return;
    setIsPurchasing(true);
    setError(null);
    try {
      const result = await api.post<LabelPurchaseResult>(
        API_ROUTES.ADMIN.ORDER_BUY_LABEL(orderId),
        { rateId: selectedRate },
      );
      onLabelPurchased(result);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Label purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-surface rounded-card border border-border shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-label-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 id="buy-label-title" className="font-bold text-secondary text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Purchase Shipping Label
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1">
          {/* Ship-to summary */}
          <div className="bg-[#FAFAF8] rounded-xl p-4 mb-5 text-sm border border-border">
            <p className="font-semibold text-secondary">{shippingName}</p>
            <p className="text-muted">
              {shippingCity}{shippingState ? `, ${shippingState}` : ''} · {shippingCountry}
            </p>
          </div>

          {/* Rate list */}
          {isLoadingRates ? (
            <div className="flex flex-col items-center py-8 gap-2 text-muted">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm">Fetching rates from USPS / UPS / FedEx…</p>
            </div>
          ) : error ? (
            <p className="text-red-600 text-sm text-center py-4 px-4 bg-red-50 border border-red-200 rounded-card">
              {error}
            </p>
          ) : rates.length === 0 ? (
            <p className="text-muted text-center py-4 text-sm">
              No rates available for this address.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted mb-3 uppercase tracking-wide">
                Select a shipping option
              </p>
              {rates.map((rate) => (
                <label
                  key={rate.id}
                  className={[
                    'flex items-center gap-4 p-3.5 border rounded-xl cursor-pointer transition-colors',
                    selectedRate === rate.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="rate"
                    value={rate.id}
                    checked={selectedRate === rate.id}
                    onChange={() => setSelectedRate(rate.id)}
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-secondary">
                      {rate.carrier} {rate.service}
                    </p>
                    {rate.deliveryDays != null && (
                      <p className="text-xs text-muted">
                        {rate.deliveryDays} day{rate.deliveryDays !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-secondary tabular-nums shrink-0">
                    ${rate.price.toFixed(2)}
                  </span>
                  {selectedRate === rate.id && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-surface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={!selectedRate || isPurchasing || isLoadingRates}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Purchase label
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
