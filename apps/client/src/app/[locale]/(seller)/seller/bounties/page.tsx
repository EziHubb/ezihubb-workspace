'use client';
import { useEffect, useState } from 'react';
import { api } from '@mlh/api-client';

interface BountyEntry {
  id: string;
  previewImageUrl: string;
  description: string | null;
  status: string;
}

interface Bounty {
  id: string;
  title: string;
  budget: number;
  status: string;
  deadline: string;
  entryCount: number;
  entries?: BountyEntry[];
}

export default function SellerBountiesPage() {
  const [bounties, setBounties]     = useState<Bounty[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm] = useState({
    title: '', brief: '', budget: '', deadline: '', maxSubmissions: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);

  const fetchBounties = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ posted: Bounty[] }>('/marketplace/bounties/me');
      setBounties(Array.isArray(data?.posted) ? data.posted : []);
    } catch {
      setBounties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBounties(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/marketplace/bounties', {
        title: form.title,
        brief: form.brief,
        budget: parseFloat(form.budget),
        deadline: new Date(form.deadline).toISOString(),
        maxSubmissions: form.maxSubmissions ? parseInt(form.maxSubmissions) : undefined,
      });
      setShowForm(false);
      setForm({ title: '', brief: '', budget: '', deadline: '', maxSubmissions: '' });
      await fetchBounties();
    } catch {
      // silently fail — server validation errors visible in network tab
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectWinner = async (bountyId: string, entryId: string) => {
    setSelectingWinner(entryId);
    try {
      await api.post(`/marketplace/bounties/${bountyId}/select-winner`, { entryId });
      await fetchBounties();
    } catch {
      alert('Could not select winner. Please try again.');
    } finally {
      setSelectingWinner(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Design Bounties</h1>
          <p className="text-sm text-muted mt-0.5">Post design briefs and reward talented creators</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-4 py-2.5 rounded-button transition-colors"
        >
          {showForm ? 'Cancel' : 'Post Bounty'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-card p-5 space-y-4">
          <h2 className="font-semibold text-secondary">New Design Bounty</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Title</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Summer nurse mug design"
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Budget ($, min $15)</label>
              <input
                required
                type="number"
                step="1"
                min="15"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Design Brief</label>
            <textarea
              required
              rows={4}
              value={form.brief}
              onChange={e => setForm(f => ({ ...f, brief: e.target.value }))}
              placeholder="Describe the design you need — style, colors, message, etc."
              className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Deadline</label>
              <input
                required
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Max Submissions (optional)</label>
              <input
                type="number"
                min="1"
                value={form.maxSubmissions}
                onChange={e => setForm(f => ({ ...f, maxSubmissions: e.target.value }))}
                className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-4 py-2.5 rounded-button disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Bounty'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-card border border-border bg-surface p-4 animate-pulse h-32" />
          ))}
        </div>
      ) : bounties.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-border py-12 text-center text-muted">
          No bounties posted yet.
        </div>
      ) : (
        <div className="space-y-4">
          {bounties.map(bounty => (
            <div key={bounty.id} className="bg-surface border border-border rounded-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-secondary">{bounty.title}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Deadline: {new Date(bounty.deadline).toLocaleDateString()} &middot; {bounty.entryCount} submissions
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-green-600 tabular-nums">
                    ${Number(bounty.budget).toFixed(0)}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      bounty.status === 'OPEN'
                        ? 'bg-green-100 text-green-800'
                        : bounty.status === 'COMPLETED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-muted/10 text-muted'
                    }`}
                  >
                    {bounty.status}
                  </span>
                </div>
              </div>

              {bounty.entries && bounty.entries.length > 0 && bounty.status === 'OPEN' && (
                <div>
                  <p className="text-xs font-semibold text-muted mb-2">Submissions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {bounty.entries.map(entry => (
                      <div key={entry.id} className="rounded-card overflow-hidden border border-border bg-background">
                        {entry.previewImageUrl && (
                          <img
                            src={entry.previewImageUrl}
                            alt="submission"
                            className="w-full aspect-square object-cover"
                          />
                        )}
                        <div className="p-2 space-y-1">
                          {entry.description && (
                            <p className="text-xs text-muted line-clamp-2">{entry.description}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectWinner(bounty.id, entry.id)}
                            disabled={selectingWinner === entry.id}
                            className="w-full rounded bg-green-600 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {selectingWinner === entry.id ? '…' : 'Select Winner'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
