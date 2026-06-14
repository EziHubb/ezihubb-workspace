'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';

export interface SeasonalBannerProps {
  text:          string;
  ctaLabel?:     string;
  ctaHref?:      string;
  countdownEnd?: string | Date;
  emoji?:        string;
  /** gradient CSS string, e.g. 'linear-gradient(135deg, #1A7A3F 0%, #0F5C2E 100%)' */
  gradient?:     string;
  dismissable?:  boolean;
}

export function SeasonalBanner({
  text,
  ctaLabel,
  ctaHref    = '#',
  countdownEnd,
  emoji,
  gradient   = 'linear-gradient(135deg, #E85D3F 0%, #C44A2E 100%)',
  dismissable = true,
}: SeasonalBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 md:px-8 gap-3"
      style={{ background: gradient }}
    >
      {/* Left: emoji + text */}
      <div className="flex items-center gap-2 min-w-0">
        {emoji && <span className="text-xl shrink-0" aria-hidden>{emoji}</span>}
        <p className="text-white text-sm font-medium truncate">{text}</p>
      </div>

      {/* Center: optional countdown */}
      {countdownEnd && (
        <div className="hidden sm:flex shrink-0">
          <CountdownTimer targetDate={countdownEnd} size="sm" />
        </div>
      )}

      {/* Right: CTA + dismiss */}
      <div className="flex items-center gap-2 shrink-0">
        {ctaLabel && (
          <a
            href={ctaHref}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors whitespace-nowrap"
          >
            {ctaLabel}
          </a>
        )}
        {dismissable && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
