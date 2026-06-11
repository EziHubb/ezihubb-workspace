'use client';
import { useEffect, useState } from 'react';
import { api } from '@mlh/api-client';

interface DesignLicense {
  id: string;
  purchasePrice: number;
  royaltyRate: number | null;
  status: string;
  purchasedAt: string;
  asset: { title: string; previewImageUrl: string };
  licenseeStore?: { name: string };
  licensorStore?: { name: string };
}

type Role = 'licensor' | 'licensee';

export default function SellerDesignsPage() {
  const [role, setRole]         = useState<Role>('licensor');
  const [licenses, setLicenses] = useState<DesignLicense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', previewImageUrl: '', fullResImageUrl: '',
    licenseType: 'NON_EXCLUSIVE', licenseModel: 'ONE_TIME', listingPrice: '', royaltyRate: '', tags: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const data = await api.get<DesignLicense[]>(`/seller/licenses?role=${role}`);
      setLicenses(Array.isArray(data) ? data : []);
    } catch {
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLicenses(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleListDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/seller/designs', {
        ...form,
        listingPrice: parseFloat(form.listingPrice),
        royaltyRate: form.royaltyRate ? parseFloat(form.royaltyRate) / 100 : undefined,
        tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({
        title: '', description: '', previewImageUrl: '', fullResImageUrl: '',
        licenseType: 'NON_EXCLUSIVE', licenseModel: 'ONE_TIME', listingPrice: '', royaltyRate: '', tags: '',
      });
      await fetchLicenses();
    } catch {
      // silently fail — server validation errors visible in network tab
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Design Licenses</h1>
          <p className="text-sm text-muted mt-0.5">License your original designs or manage licensed designs you use</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-4 py-2.5 rounded-button transition-colors"
        >
          {showForm ? 'Cancel' : 'List a Design'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleListDesign} className="bg-surface border border-border rounded-card p-5 space-y-4">
          <h2 className="font-semibold text-secondary">List Design for Licensing</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Title</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Listing Price ($)</label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                value={form.listingPrice}
                onChange={e => setForm(f => ({ ...f, listingPrice: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Preview Image URL</label>
              <input
                type="url"
                required
                value={form.previewImageUrl}
                onChange={e => setForm(f => ({ ...f, previewImageUrl: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Full-Res Image URL</label>
              <input
                type="url"
                required
                value={form.fullResImageUrl}
                onChange={e => setForm(f => ({ ...f, fullResImageUrl: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">License Type</label>
              <select
                value={form.licenseType}
                onChange={e => setForm(f => ({ ...f, licenseType: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="NON_EXCLUSIVE">Non-Exclusive</option>
                <option value="EXCLUSIVE">Exclusive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">License Model</label>
              <select
                value={form.licenseModel}
                onChange={e => setForm(f => ({ ...f, licenseModel: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="ONE_TIME">One-Time Fee</option>
                <option value="ROYALTY_PER_SALE">Royalty Per Sale</option>
                <option value="BOTH">One-Time + Royalty</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Royalty % (optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder="e.g. 5"
                value={form.royaltyRate}
                onChange={e => setForm(f => ({ ...f, royaltyRate: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="floral, watercolor, nature"
              className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-4 py-2.5 rounded-button disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Listing…' : 'List Design'}
          </button>
        </form>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border">
        {(['licensor', 'licensee'] as Role[]).map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              role === r
                ? 'border-primary text-secondary'
                : 'border-transparent text-muted hover:text-secondary'
            }`}
          >
            {r === 'licensor' ? 'My Designs (Licensor)' : 'Licensed Designs (Licensee)'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-card border border-border bg-surface p-4 animate-pulse h-40" />
          ))}
        </div>
      ) : licenses.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-border py-12 text-center text-muted">
          {role === 'licensor' ? 'No designs listed yet.' : 'No licenses purchased yet.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {licenses.map(license => (
            <div key={license.id} className="rounded-card border border-border bg-surface overflow-hidden">
              <div className="aspect-video bg-muted/10">
                {license.asset?.previewImageUrl && (
                  <img
                    src={license.asset.previewImageUrl}
                    alt={license.asset.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="font-medium text-sm text-secondary truncate">{license.asset?.title}</p>
                <p className="text-xs text-muted">
                  {role === 'licensor'
                    ? `To: ${license.licenseeStore?.name ?? 'N/A'}`
                    : `From: ${license.licensorStore?.name ?? 'N/A'}`}
                </p>
                <p className="text-xs font-medium text-secondary tabular-nums">
                  ${Number(license.purchasePrice).toFixed(2)}
                  {license.royaltyRate
                    ? ` + ${(Number(license.royaltyRate) * 100).toFixed(1)}% royalty`
                    : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
