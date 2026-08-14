'use client';

import { useState } from 'react';
import { Gift, Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '../../lib/store/auth.store';

/**
 * Etsy Share & Save — only shown to a logged-in buyer, since the reward goes
 * to whoever generated the link (identified by their own user id in the
 * `?ss=` param), not whoever happens to click it. A signed-out visitor has
 * no identity to attach the link to, so there's nothing to show them here.
 * Rendered on the shop page itself, so the current URL (minus any existing
 * query string) is already the exact link to personalize.
 */
export function ShareSaveWidget() {
  const t = useTranslations('shops.shareSave');
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?ss=${user.id}`
    : '';

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 border border-border rounded-2xl px-4 py-3 bg-[#FAFAF8]">
      <Gift className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary">{t('title')}</p>
        <p className="text-xs text-muted">{t('description')}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 shrink-0 border border-border rounded-full px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-white transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t('copied') : t('copyLink')}
      </button>
    </div>
  );
}
