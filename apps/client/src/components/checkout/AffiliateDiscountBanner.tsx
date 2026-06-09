'use client';

interface Props {
  discountRate:   number;       // 0.05 = 5%
  affiliateName?: string;       // shown as "thanks to Sarah!"
  discountAmount: number;       // dollar amount to display
}

export function AffiliateDiscountBanner({ discountRate, affiliateName, discountAmount }: Props) {
  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200
                    rounded-xl px-4 py-3 mb-4">
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center
                      justify-center flex-shrink-0">
        <i className="ti ti-gift text-green-600 text-sm" />
      </div>
      <div>
        <p className="text-sm font-semibold text-green-800">
          You&apos;re saving {Math.round(discountRate * 100)}%
          {affiliateName ? ` — thanks to ${affiliateName}!` : '!'}
        </p>
        <p className="text-xs text-green-600 mt-0.5">
          Referral discount of ${discountAmount.toFixed(2)} applied automatically.
        </p>
      </div>
      <div className="ml-auto">
        <span className="text-sm font-bold text-green-700">
          −${discountAmount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
