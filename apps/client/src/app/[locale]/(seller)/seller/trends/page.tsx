'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Check, X, Pencil } from 'lucide-react';
import { apiClient } from '@mlh/api-client';

interface TrendDraft {
  id:                   string;
  trendTopic:           string;
  trendEngagement:      number;
  generatedImageUrl:    string;
  suggestedProductName: string;
  suggestedDescription: string;
  suggestedTags:        string[];
  designBrief: {
    productType:    string;
    colorPalette:   string;
    style:          string;
    textContent:    string;
    targetAudience: string;
  };
  expiresAt: string;
  status:    string;
}

interface TrendTopic {
  hashtag:         string;
  engagementScore: number;
  description:     string;
}

function fmtEngagement(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

// ── Draft card ───────────────────────────────────────────────────────────────

function TrendDraftCard({
  draft, onApprove, onReject, approving, onEdit,
}: {
  draft:    TrendDraft;
  onApprove: () => void;
  onReject:  () => void;
  approving: boolean;
  onEdit:    () => void;
}) {
  const [approved, setApproved] = useState(false);

  const handleApprove = () => {
    setApproved(true);
    onApprove();
  };

  return (
    <div className="rounded-2xl bg-white border overflow-hidden hover:shadow-md transition-shadow" style={{ borderColor: '#E8E4DF' }}>
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100">
        {draft.generatedImageUrl ? (
          <img
            src={draft.generatedImageUrl}
            alt={draft.suggestedProductName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🎨</div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-900"
            style={{ background: '#F59E0B' }}
          >
            #{draft.trendTopic}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
            style={{ background: '#7C3AED' }}
          >
            AI generated
          </span>
        </div>

        {/* Bottom text overlay */}
        <div
          className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-8"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
        >
          <p className="font-semibold text-white text-sm leading-tight drop-shadow">
            {draft.suggestedProductName}
          </p>
        </div>

        {/* Approving overlay */}
        {approving && !approved && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-xs font-medium text-gray-600">Creating product…</p>
          </div>
        )}
        {approved && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: '#F0FDF4' }}
          >
            <Check className="w-8 h-8" style={{ color: '#2E7D52' }} />
            <p className="text-xs font-semibold" style={{ color: '#2E7D52' }}>Created! View product →</p>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3.5 space-y-2.5">
        <p className="text-xs text-gray-500 line-clamp-1">{draft.suggestedDescription}</p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={approving || approved}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: '#E85D3F' }}
          >
            <Check className="w-3.5 h-3.5" />
            Create product
          </button>
          <button
            onClick={onReject}
            disabled={approving}
            className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: '#E8E4DF' }}
          >
            <X className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>

        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit first
        </button>
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditDraftModal({ draft, onClose, onApprove }: {
  draft:     TrendDraft;
  onClose:   () => void;
  onApprove: () => void;
}) {
  const [name,  setName]  = useState(draft.suggestedProductName);
  const [desc,  setDesc]  = useState(draft.suggestedDescription);
  const [price, setPrice] = useState('27.99');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E8E4DF' }}>
          <h4 className="font-semibold text-gray-900">Edit draft before creating</h4>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 p-5">
          {/* Image */}
          <div className="space-y-2">
            <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
              {draft.generatedImageUrl ? (
                <img src={draft.generatedImageUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">🎨</div>
              )}
            </div>
            <button className="w-full rounded-xl border py-2 text-xs font-medium text-gray-600 hover:bg-gray-50" style={{ borderColor: '#E8E4DF' }}>
              <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
              Regenerate image
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Product name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: '#E8E4DF' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none resize-none"
                style={{ borderColor: '#E8E4DF' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Price</label>
              <div className="flex items-center rounded-xl border px-3.5 py-2.5" style={{ borderColor: '#E8E4DF' }}>
                <span className="text-gray-400 text-sm mr-1">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="flex-1 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {draft.suggestedTags?.slice(0, 4).map(tag => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={onApprove}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: '#E85D3F' }}
            >
              Create product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [drafts, setDrafts]           = useState<TrendDraft[]>([]);
  const [topics, setTopics]           = useState<TrendTopic[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [approving, setApproving]     = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [editDraft, setEditDraft]     = useState<TrendDraft | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [draftData, topicData] = await Promise.all([
        apiClient.get<TrendDraft[]>('/seller/trends'),
        apiClient.get<TrendTopic[]>('/seller/trends/topics'),
      ]);
      setDrafts(Array.isArray(draftData) ? draftData : []);
      setTopics(Array.isArray(topicData) ? topicData : []);
      setLastUpdated(new Date());
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
      await apiClient.post<{ productSlug: string }>(`/seller/trends/${draftId}/approve`, {});
      setTimeout(() => setDrafts(d => d.filter(x => x.id !== draftId)), 1500);
    } catch {
      // ignore
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

  const selectedTopicData = topics.find(t => t.hashtag === selectedTopic);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div
        className="rounded-2xl px-6 py-5 flex items-start justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #FFF0EC 0%, #FFFDF9 100%)' }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trending right now</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI generates ready-to-publish products from today&apos;s trends.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-400">
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50 transition-colors"
            style={{ borderColor: '#E8E4DF' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Trend topics */}
      {topics.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">🔥 Trending now on TikTok</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {topics.slice(0, 10).map(t => (
              <button
                key={t.hashtag}
                onClick={() => setSelectedTopic(selectedTopic === t.hashtag ? null : t.hashtag)}
                className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all hover:border-orange-300"
                style={selectedTopic === t.hashtag
                  ? { background: '#E85D3F', borderColor: '#E85D3F', color: '#fff' }
                  : { borderColor: '#E8E4DF', color: '#374151' }
                }
              >
                #{t.hashtag} &nbsp;{fmtEngagement(t.engagementScore)}
              </button>
            ))}
          </div>

          {/* Topic expansion */}
          {selectedTopicData && (
            <div
              className="rounded-xl p-4 space-y-2 animate-in fade-in slide-in-from-top-1"
              style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
            >
              <h5 className="font-semibold text-sm" style={{ color: '#D97706' }}>
                #{selectedTopicData.hashtag}
              </h5>
              <p className="text-xs text-gray-600">
                {fmtEngagement(selectedTopicData.engagementScore)} views today · {selectedTopicData.description}
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: '#E85D3F' }}
              >
                {generating ? 'Generating…' : 'Generate products for this trend →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Drafts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Ready for you — tap to approve</h2>
            <p className="text-xs text-gray-400 mt-0.5">Generated for your store</p>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border bg-white animate-pulse h-80" style={{ borderColor: '#E8E4DF' }} />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-2xl">🤖</div>
            <h4 className="font-semibold text-gray-700">No trend drafts yet</h4>
            <p className="text-sm text-gray-400">AI generates 3 new product ideas daily based on trending topics.</p>
            <p className="text-xs text-gray-400">Next update: 9:00 AM tomorrow</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              style={{ borderColor: '#E8E4DF' }}
            >
              {generating ? 'Generating…' : 'Refresh trends now'}
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
                onEdit={() => setEditDraft(draft)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editDraft && (
        <EditDraftModal
          draft={editDraft}
          onClose={() => setEditDraft(null)}
          onApprove={() => { handleApprove(editDraft.id); setEditDraft(null); }}
        />
      )}
    </div>
  );
}
