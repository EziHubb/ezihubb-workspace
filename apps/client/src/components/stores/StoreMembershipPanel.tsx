'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface Membership {
  id:              string;
  name:            string;
  description:     string;
  price:           number;
  perks:           string[];
  subscriberCount: number;
}

interface StoreMembershipPanelProps {
  storeSlug: string;
}

const DEFAULT_PERKS = [
  { icon: '⚡', text: '24h early drop access' },
  { icon: '🏷️', text: '10% off always' },
  { icon: '🔒', text: 'Fan-only designs' },
];

export function StoreMembershipPanel({ storeSlug }: StoreMembershipPanelProps) {
  const [membership, setMembership]   = useState<Membership | null>(null);
  const [isFan, setIsFan]             = useState(false);
  const [loading, setLoading]         = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Membership>(`/stores/${storeSlug}/membership`)
      .then(setMembership)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeSlug]);

  const handleSubscribe = async () => {
    if (!membership) return;
    setSubscribing(true);
    setError(null);
    try {
      const res = await apiClient.post<{ subscriptionId: string; clientSecret: string | null }>(
        `/memberships/${membership.id}/subscribe`,
        {},
      );
      if (res.clientSecret) {
        window.location.href = `/checkout/membership?secret=${res.clientSecret}`;
      } else {
        setIsFan(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      setError(msg ?? 'Could not subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading || !membership) return null;

  // ── Already a fan ─────────────────────────────────────────────────────────
  if (isFan) {
    return (
      <div
        className="rounded-2xl p-5 border"
        style={{ background: '#F3F0FF', borderColor: '#C4B5FD' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm" style={{ color: '#7C3AED' }}>
            ⭐ You&apos;re a fan!
          </span>
          <a href="/account/membership" className="text-xs font-medium" style={{ color: '#7C3AED' }}>
            Manage →
          </a>
        </div>
        <p className="text-xs mt-1" style={{ color: '#7C3AED', opacity: 0.8 }}>
          Early access to drops · 10% off every order
        </p>
      </div>
    );
  }

  // ── Join fan club card ────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ background: 'linear-gradient(135deg, #EEEDFE 0%, #F3F0FF 100%)', borderColor: '#C4B5FD' }}
    >
      <div className="flex gap-5">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-base" style={{ color: '#7C3AED' }}>
              ⭐ {membership.name}
            </span>
            <span className="text-xs text-gray-500">{membership.subscriberCount} fans</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">{membership.description}</p>
          <div className="flex flex-wrap gap-3">
            {DEFAULT_PERKS.map((perk, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-gray-700">
                {perk.icon} {perk.text}
              </span>
            ))}
          </div>
        </div>

        {/* Right: price + CTA */}
        <div
          className="flex flex-col items-center justify-center text-center pl-5 shrink-0"
          style={{ borderLeft: '1px solid #DDD6FE' }}
        >
          <span className="text-2xl font-bold" style={{ color: '#7C3AED' }}>
            ${Number(membership.price).toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 mb-3">/month</span>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#7C3AED' }}
          >
            {subscribing ? 'Joining…' : 'Join fan club'}
          </button>
          <p className="text-[10px] text-gray-400 mt-1.5">Cancel anytime</p>
        </div>
      </div>
      {error && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  );
}
