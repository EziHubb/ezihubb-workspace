'use client';

import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface ReferralSharePanelProps {
  /** The order's UUID (order.id), used to call the buyer-referral endpoint */
  orderId: string;
}

interface ReferralLinkResponse {
  referralLink: string;
  expiresAt:    string;
}

export function ReferralSharePanel({ orderId }: ReferralSharePanelProps) {
  const token = useAuthStore((s) => s.accessToken);

  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [expiresAt,    setExpiresAt]    = useState<string | null>(null);

  const generateLink = async () => {
    setLoading(true);
    try {
      const data = await apiClient.post<ReferralLinkResponse>(
        API_ROUTES.STORE_CREDITS.BUYER_REFERRAL_LINK(orderId),
        undefined,
        { token: token ?? undefined },
      );
      setReferralLink(data.referralLink);
      setExpiresAt(data.expiresAt);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Pre-generate state ────────────────────────────────────────────────────────

  if (!referralLink) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-semibold text-amber-900 mb-1">Share &amp; Earn Store Credit</h3>
        <p className="text-sm text-amber-700 mb-3">
          Share this order with friends. When they make their first purchase, you earn $5 store credit.
        </p>
        <button
          type="button"
          onClick={generateLink}
          disabled={loading}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Get Referral Link'}
        </button>
      </div>
    );
  }

  // ── Post-generate state ───────────────────────────────────────────────────────

  const encodedLink = encodeURIComponent(referralLink);
  const expiryText  = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day:   'numeric',
        year:  'numeric',
      })
    : null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
      <h3 className="font-semibold text-amber-900">Share &amp; Earn Store Credit</h3>

      {expiryText && (
        <p className="text-xs text-amber-600">Link expires {expiryText}</p>
      )}

      {/* Copy row */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={referralLink}
          aria-label="Referral link"
          className="flex-1 rounded border border-amber-300 bg-white px-3 py-1.5 text-sm font-mono text-gray-700 truncate"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Social share buttons */}
      <div className="flex gap-3">
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedLink}&text=Check+out+this+handmade+shop!`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 transition-colors"
        >
          Share on X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Share on Facebook
        </a>
      </div>
    </div>
  );
}
