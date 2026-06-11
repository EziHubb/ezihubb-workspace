'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface MembershipStats {
  id?:              string;
  name?:            string;
  price?:           number;
  subscriberCount?: number;
  mrr?:             number;
}

export function SellerMembershipCard() {
  const [stats, setStats]       = useState<MembershipStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', description: '', price: '', perks: '' });
  const [saving, setSaving]     = useState(false);

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
        perks:       form.perks.split('\n').map(p => p.trim()).filter(Boolean),
      });
      setShowForm(false);
      // Refresh stats
      const updated = await apiClient.get<MembershipStats>('/seller/membership/stats');
      setStats(updated);
    } catch {
      // ignore — server errors silently dropped; could add error state here
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-lg border bg-white p-5 animate-pulse h-32" />;

  if (stats?.id) {
    return (
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Fan Membership</h3>
            <p className="text-sm text-gray-600">{stats.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-700">
              ${(stats.mrr ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">MRR</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">{stats.subscriberCount ?? 0}</div>
            <div className="text-xs text-gray-500">Active fans</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">${Number(stats.price ?? 0).toFixed(2)}</div>
            <div className="text-xs text-gray-500">Price/month</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 space-y-3">
      <h3 className="font-semibold text-gray-900">Fan Membership</h3>
      <p className="text-sm text-gray-600">
        Create a monthly membership to reward your most loyal fans with exclusive perks.
      </p>
      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            required
            placeholder="Membership name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            min="1"
            placeholder="Monthly price ($)"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <textarea
            rows={4}
            placeholder="Perks (one per line)"
            value={form.perks}
            onChange={e => setForm(f => ({ ...f, perks: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Membership'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Create Fan Membership
        </button>
      )}
    </div>
  );
}
