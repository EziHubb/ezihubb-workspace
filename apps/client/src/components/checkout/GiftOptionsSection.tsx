'use client';

import { useTranslations } from 'next-intl';
import { Check, Gift } from 'lucide-react';

export interface GiftOptions {
  isGift:       boolean;
  giftMessage:  string;
  giftReceipt:  boolean;
  giftWrapping: boolean;
  giftFrom:     string;
}

interface Props {
  value:    GiftOptions;
  onChange: (opts: GiftOptions) => void;
}

export function GiftOptionsSection({ value, onChange }: Props) {
  const t = useTranslations('checkout.giftOptions');
  const update = (partial: Partial<GiftOptions>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {/* Toggle row */}
      <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors">
        <div
          className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${
            value.isGift ? 'bg-primary' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              value.isGift ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
          <input
            type="checkbox"
            className="sr-only"
            checked={value.isGift}
            onChange={(e) => update({ isGift: e.target.checked })}
          />
        </div>
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-primary" />
            {t('isGift')}
          </p>
          <p className="text-xs text-muted">{t('addOptionsHint')}</p>
        </div>
      </label>

      {/* Expanded gift options */}
      {value.isGift && (
        <div className="border-t border-border px-4 pb-4 pt-4 space-y-4 bg-[#FFFDF9]">

          {/* Gift from */}
          <div>
            <label className="text-xs font-medium block mb-1.5">{t('from')}</label>
            <input
              value={value.giftFrom}
              onChange={(e) => update({ giftFrom: e.target.value })}
              placeholder={t('fromPlaceholder')}
              maxLength={100}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
            />
          </div>

          {/* Gift message */}
          <div>
            <label className="text-xs font-medium block mb-1.5">
              {t('message')}
              <span className="text-muted font-normal ml-1">{t('optional')}</span>
            </label>
            <textarea
              value={value.giftMessage}
              onChange={(e) => update({ giftMessage: e.target.value })}
              placeholder={t('messagePlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
            />
            <p className="text-xs text-muted text-right mt-1">
              {value.giftMessage.length}/500
            </p>
          </div>

          {/* Gift receipt */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                value.giftReceipt ? 'bg-secondary border-secondary' : 'border-border'
              }`}
            >
              {value.giftReceipt && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <div>
              <p className="text-sm font-medium">{t('sendReceipt')}</p>
              <p className="text-xs text-muted">{t('receiptNote')}</p>
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={value.giftReceipt}
              onChange={(e) => update({ giftReceipt: e.target.checked })}
            />
          </label>

          {/* Gift wrapping */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                value.giftWrapping ? 'bg-secondary border-secondary' : 'border-border'
              }`}
            >
              {value.giftWrapping && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('addWrapping')}</p>
              <p className="text-xs text-muted">{t('wrappingNote')}</p>
            </div>
            <span className="text-sm font-semibold text-primary">{t('wrappingPrice')}</span>
            <input
              type="checkbox"
              className="sr-only"
              checked={value.giftWrapping}
              onChange={(e) => update({ giftWrapping: e.target.checked })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
