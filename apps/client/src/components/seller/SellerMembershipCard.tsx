'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@ezihubb/api-client';

interface MembershipStats {
  id?:              string;
  name?:            string;
  price?:           number;
  subscriberCount?: number;
  mrr?:             number;
  churnRate?:       number;
}

const PERK_OPTIONS = [
  { key: 'earlyAccess', label: '24h early access to drops' },
  { key: 'discount',    label: 'Discount % off all orders' },
  { key: 'fanProducts', label: 'Fan-exclusive products' },
  { key: 'monthly',     label: 'Monthly exclusive design (manual)' },
];

export function SellerMembershipCard() {
  const [stats, setStats]       = useState<MembershipStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name:        '',
    description: '',
    price:       '4.99',
    discount:    '10',
    perks:       ['earlyAccess', 'discount', 'fanProducts'] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<MembershipStats>('/seller/membership/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post('/seller/membership', {
        name:        form.name,
        description: form.description,
        price:       parseFloat(form.price),
        perks:       form.perks,
      });
      setShowForm(false);
      const updated = await apiClient.get<MembershipStats>('/seller/membership/stats');
      setStats(updated);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const togglePerk = (key: string) => {
    setForm(f => ({
      ...f,
      perks: f.perks.includes(key) ? f.perks.filter(p => p !== key) : [...f.perks, key],
    }));
  };

  if (loading) return <div className="rounded-2xl border bg-white p-5 animate-pulse h-36" style={{ borderColor: '#E8E4DF' }} />;

  // ── Active membership ─────────────────────────────────────────────────────
  if (stats?.id) {
    const mrr = stats.mrr ?? 0;
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4" style={{ borderColor: '#E8E4DF' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Fan Membership</h3>
            <p className="text-sm text-gray-500">{stats.name}</p>
          </div>
          <a href="/seller/store?tab=membership" className="text-xs font-medium" style={{ color: '#E85D3F' }}>
            Edit →
          </a>
        </div>

        {/* KPI pills */}
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700" style={{ borderColor: '#E8E4DF' }}>
            {stats.subscriberCount ?? 0} fans
          </span>
          <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700" style={{ borderColor: '#E8E4DF' }}>
            MRR: ${mrr.toFixed(2)}
          </span>
          {stats.churnRate != null && (
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700" style={{ borderColor: '#E8E4DF' }}>
              Churn: {stats.churnRate.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── No membership yet ─────────────────────────────────────────────────────
  if (!showForm) {
    return (
      <div
        className="rounded-2xl p-6 text-center space-y-3"
        style={{ background: 'linear-gradient(135deg, #F3F0FF 0%, #EEEDFE 100%)', border: '1px solid #DDD6FE' }}
      >
        <div className="text-4xl">💜</div>
        <h3 className="font-bold text-gray-900 text-base">Turn buyers into fans</h3>
        <p className="text-sm text-gray-500">
          Offer a monthly membership. Fans get perks, you get recurring income.
        </p>
        <p className="text-xs font-medium" style={{ color: '#7C3AED' }}>
          If 100 fans × $4.99 = $498 guaranteed/month
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white mt-2"
          style={{ background: '#7C3AED' }}
        >
          Enable fan membership
        </button>
      </div>
    );
  }

  // ── Create form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleCreate} className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm" style={{ borderColor: '#E8E4DF' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Set up fan membership</h3>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Club name</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. EziHubb Fan Club"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#E8E4DF' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Monthly price</label>
          <div className="flex items-center gap-1 rounded-xl border px-3.5 py-2.5" style={{ borderColor: '#E8E4DF' }}>
            <span className="text-sm text-gray-400">$</span>
            <input
              required
              type="number"
              step="0.01"
              min="2.99"
              max="19.99"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              className="flex-1 text-sm focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Range: $2.99–$19.99</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Your biggest fans, exclusive access…"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#E8E4DF' }}
          />
        </div>

        {/* Perks */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Perks</label>
          <div className="space-y-2">
            {PERK_OPTIONS.map(perk => (
              <label key={perk.key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.perks.includes(perk.key)}
                  onChange={() => togglePerk(perk.key)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: '#7C3AED' }}
                />
                <span className="text-xs text-gray-700">{perk.label}</span>
                {perk.key === 'discount' && form.perks.includes('discount') && (
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.discount}
                    onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                    className="w-12 rounded border px-1.5 py-0.5 text-xs"
                    style={{ borderColor: '#E8E4DF' }}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: '#7C3AED' }}
      >
        {saving ? 'Creating…' : 'Save membership settings'}
      </button>
    </form>
  );
}
