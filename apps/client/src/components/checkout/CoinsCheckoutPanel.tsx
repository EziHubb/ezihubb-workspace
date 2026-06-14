'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const COIN_TO_DOLLAR = 100; // 100 coins = $1

interface CoinsCheckoutPanelProps {
  availableCoins: number;
  coinsUsed:      number;
  onChange:       (coins: number) => void;
  orderTotal:     number;
}

export function CoinsCheckoutPanel({
  availableCoins,
  coinsUsed,
  onChange,
  orderTotal,
}: CoinsCheckoutPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (availableCoins === 0) return null;

  const maxRedeemable  = Math.min(availableCoins, Math.floor(orderTotal * COIN_TO_DOLLAR));
  const dollarValue    = availableCoins / COIN_TO_DOLLAR;
  const discount       = coinsUsed / COIN_TO_DOLLAR;
  const nextMilestone  = availableCoins < 500 ? 500 : availableCoins < 1000 ? 1000 : null;
  const coinsToNextFreeShip = Math.max(0, 500 - availableCoins);

  return (
    <div className="bg-[#FFFBEA] border border-[#FCD34D] rounded-xl overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FFF8D6] transition-colors"
      >
        <span className="text-xl shrink-0" aria-hidden>🪙</span>
        <span className="flex-1 text-left text-sm font-semibold text-secondary">
          {availableCoins.toLocaleString()} BuyCoins available
          <span className="text-muted font-normal ml-1">=  ${dollarValue.toFixed(2)}</span>
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-[#FCD34D]/50 px-4 pb-4 pt-3 space-y-4">
          {/* Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Using:</span>
              <span className="font-bold text-secondary tabular-nums">
                {coinsUsed.toLocaleString()} coins
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxRedeemable}
              step={100}
              value={coinsUsed}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-primary h-2 rounded-full cursor-pointer"
              aria-label="Coins to use"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>0</span>
              <span>{maxRedeemable.toLocaleString()} max</span>
            </div>
          </div>

          {/* Calculation */}
          {coinsUsed > 0 && (
            <div className="bg-white rounded-lg p-3 space-y-1.5 text-sm border border-[#FCD34D]/40">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">${orderTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-700 font-medium">
                <span>🪙 Coins ({coinsUsed.toLocaleString()})</span>
                <span className="tabular-nums">−${discount.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                <span>New total</span>
                <span className="tabular-nums">${Math.max(0, orderTotal - discount).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Milestone hint */}
          {coinsToNextFreeShip > 0 && (
            <p className="text-xs text-amber-700">
              🎁 {coinsToNextFreeShip.toLocaleString()} more coins = free shipping!
            </p>
          )}
          {nextMilestone && coinsToNextFreeShip === 0 && (
            <p className="text-xs text-amber-700">
              🎁 {(nextMilestone - availableCoins).toLocaleString()} more coins = next reward!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
