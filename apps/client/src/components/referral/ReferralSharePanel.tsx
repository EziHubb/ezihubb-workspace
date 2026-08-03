'use client';

import { useState } from 'react';
import { Gift, Copy, Check, Info } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface ReferralSharePanelProps {
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
      // silently fail
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

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // ── Pre-generate: prompt user to get link ─────────────────────────────────

  if (!referralLink) {
    return (
      <div
        className="max-w-[560px] mx-auto mt-8 rounded-2xl p-6 border"
        style={{ background: 'linear-gradient(135deg, #FFF0EC 0%, #FFFDF9 100%)', borderColor: '#F5C4B3' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FFF0EC' }}>
            <Gift className="w-5 h-5" style={{ color: '#E85D3F' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 text-base">Share &amp; earn $4 store credit</h4>
            <p className="text-sm text-gray-500 mt-0.5">
              When a friend buys through your link, you automatically get $4 off your next order.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={generateLink}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#E85D3F' }}
          >
            {loading ? 'Generating…' : 'Get your referral link'}
          </button>
        </div>
      </div>
    );
  }

  // ── Post-generate: share panel ────────────────────────────────────────────

  const encodedLink = encodeURIComponent(referralLink);
  const waText      = encodeURIComponent('Check out this handmade shop! ' + referralLink);

  return (
    <div
      className="max-w-[560px] mx-auto mt-8 rounded-2xl p-6 border space-y-4"
      style={{ background: 'linear-gradient(135deg, #FFF0EC 0%, #FFFDF9 100%)', borderColor: '#F5C4B3' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FFF0EC' }}>
          <Gift className="w-5 h-5" style={{ color: '#E85D3F' }} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 text-base">Share &amp; earn $4 store credit</h4>
          <p className="text-sm text-gray-500 mt-0.5">
            When a friend buys through your link, you automatically get $4 off your next order.
          </p>
        </div>
      </div>

      {/* Copy link row */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={referralLink}
          aria-label="Referral link"
          className="flex-1 rounded-xl border bg-white px-3.5 py-2.5 text-sm font-mono text-gray-700 truncate"
          style={{ borderColor: '#E8E4DF' }}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white flex items-center gap-1.5 transition-colors"
          style={{ background: '#E85D3F' }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-green-50"
          style={{ borderColor: '#86EFAC', color: '#15803D' }}
        >
          💬 WhatsApp
        </a>
        <a
          href={`sms:&body=${waText}`}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50"
          style={{ borderColor: '#93C5FD', color: '#1D4ED8' }}
        >
          📱 iMessage
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedLink}&text=Check+out+this+handmade+shop!`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          🐦 Share on X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          More →
        </a>
      </div>

      {/* Expiry note */}
      {expiryText && (
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500">Offer valid until {expiryText}</span>
        </div>
      )}
    </div>
  );
}
