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
      // In production: redirect to Stripe checkout or embed Stripe Elements
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

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{membership.name}</h3>
          <p className="text-sm text-gray-600">{membership.description}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-700">${Number(membership.price).toFixed(2)}</div>
          <div className="text-xs text-gray-500">per month</div>
        </div>
      </div>
      {membership.perks.length > 0 && (
        <ul className="space-y-1">
          {membership.perks.map((perk, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-amber-500 mt-0.5">&#10003;</span>
              {perk}
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs text-gray-500">{membership.subscriberCount} fans joined</div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {isFan ? (
        <div className="rounded-md bg-green-100 px-3 py-2 text-sm font-medium text-green-800 text-center">
          &#11088; You&apos;re a fan member!
        </div>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {subscribing ? 'Subscribing…' : `Join Fan Club · $${Number(membership.price).toFixed(2)}/mo`}
        </button>
      )}
    </div>
  );
}
