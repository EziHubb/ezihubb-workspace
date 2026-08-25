'use client';

import { useState } from 'react';
import { X, HandCoins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { toast } from '../../lib/store/toast.store';

interface MakeOfferModalProps {
  productId: string;
  productName: string;
  basePrice: number;
  onClose: () => void;
}

export function MakeOfferModal({ productId, productName, basePrice, onClose }: MakeOfferModalProps) {
  const t = useTranslations('product.sellerCard');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const offeredPrice = Number(amount);
    if (!offeredPrice || offeredPrice <= 0 || offeredPrice >= basePrice) return;
    setSubmitting(true);
    try {
      await apiClient.post(API_ROUTES.OFFERS.CREATE, { productId, offeredPrice });
      setSent(true);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Failed to send offer';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-secondary flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-primary" /> {t('makeOffer')}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-[#F3F4F6] text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-secondary">{t('offerSent')}</p>
            <p className="text-xs text-muted mt-1">{t('offerFollowUp')}</p>
            <button type="button" onClick={onClose} className="mt-4 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-full">{t('done')}</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-muted">{t('listedAt', { name: productName, price: `${basePrice.toFixed(2)}` })}</p>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('yourOffer')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  type="number" min={0.01} max={basePrice - 0.01} step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-full transition-colors disabled:opacity-50"
            >
              {submitting ? t('sendingOffer') : t('sendOffer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
