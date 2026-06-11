'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface TrendDraft {
  id:                   string;
  trendTopic:           string;
  trendEngagement:      number;
  generatedImageUrl:    string;
  suggestedProductName: string;
  suggestedDescription: string;
  suggestedTags:        string[];
  designBrief:          {
    productType:    string;
    colorPalette:   string;
    style:          string;
    textContent:    string;
    targetAudience: string;
  };
  expiresAt:            string;
  status:               string;
}

export default function TrendsPage() {
  const [drafts, setDrafts]         = useState<TrendDraft[]>([]);
  const [topics, setTopics]         = useState<{ hashtag: string; engagementScore: number; description: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving]   = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [draftData, topicData] = await Promise.all([
        apiClient.get<TrendDraft[]>('/seller/trends'),
        apiClient.get<{ hashtag: string; engagementScore: number; description: string }[]>('/seller/trends/topics'),
      ]);
      setDrafts(Array.isArray(draftData) ? draftData : []);
      setTopics(Array.isArray(topicData) ? topicData : []);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiClient.post('/seller/trends/generate', {});
      await fetchData();
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (draftId: string) => {
    setApproving(draftId);
    try {
      const res = await apiClient.post<{ productSlug: string }>(`/seller/trends/${draftId}/approve`, {});
      alert(`Product created! Slug: ${res.productSlug}`);
      setDrafts(d => d.filter(x => x.id !== draftId));
    } catch {
      alert('Could not approve draft.');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (draftId: string) => {
    try {
      await apiClient.post(`/seller/trends/${draftId}/reject`, {});
      setDrafts(d => d.filter(x => x.id !== draftId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trend-to-Product</h1>
          <p className="text-sm text-gray-500">AI-generated product ideas from trending TikTok topics</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate New Drafts'}
        </button>
      </div>

      {topics.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Trending Now</h2>
          <div className="flex flex-wrap gap-2">
            {topics.slice(0, 8).map(t => (
              <span key={t.hashtag} className="rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-800">
                #{t.hashtag}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="rounded-xl border bg-white p-4 animate-pulse h-72" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-500 mb-4">No trend drafts yet. Generate your first set!</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate Drafts'}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map(draft => (
            <TrendDraftCard
              key={draft.id}
              draft={draft}
              onApprove={() => handleApprove(draft.id)}
              onReject={() => handleReject(draft.id)}
              approving={approving === draft.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendDraftCard({
  draft, onApprove, onReject, approving,
}: {
  draft: TrendDraft;
  onApprove: () => void;
  onReject:  () => void;
  approving: boolean;
}) {
  const expiresIn = Math.ceil((new Date(draft.expiresAt).getTime() - Date.now()) / 3600000);

  return (
    <div className="rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow">
      {draft.generatedImageUrl ? (
        <img src={draft.generatedImageUrl} alt={draft.suggestedProductName} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
          <span className="text-4xl">&#127912;</span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-800">
            {draft.trendTopic}
          </span>
          <span className="text-xs text-gray-400 ml-auto">Expires in {expiresIn}h</span>
        </div>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{draft.suggestedProductName}</h3>
        <p className="text-xs text-gray-500 line-clamp-2">{draft.suggestedDescription}</p>
        {draft.designBrief && (
          <p className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1">
            &quot;{draft.designBrief.textContent}&quot;
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            disabled={approving}
            className="flex-1 rounded-md bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {approving ? 'Creating…' : 'Approve & Create'}
          </button>
          <button
            onClick={onReject}
            disabled={approving}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
