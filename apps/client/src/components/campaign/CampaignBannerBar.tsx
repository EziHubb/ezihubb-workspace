'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';

export interface CampaignData {
  id:           string;
  bannerText:   string;
  ctaLabel:     string;
  ctaHref:      string;
  primaryColor: string;
  accentColor:  string;
  countdownEnd: string | null;
}

export function CampaignBannerBar({ campaign }: { campaign: CampaignData | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (!campaign || dismissed) return null;

  const gradient = `linear-gradient(90deg, ${campaign.primaryColor} 0%, ${campaign.accentColor} 100%)`;

  return (
    <div
      className="w-full h-10 flex items-center px-4 md:px-8 gap-3"
      style={{ background: gradient }}
    >
      <p className="text-white text-xs font-medium flex-1 text-center truncate">
        {campaign.bannerText}
      </p>
      {campaign.ctaLabel && campaign.ctaHref && (
        <Link
          href={campaign.ctaHref}
          className="shrink-0 bg-white/25 hover:bg-white/35 text-white text-xs font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap"
        >
          {campaign.ctaLabel}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-white/70 hover:text-white transition-colors p-1 ml-1"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
