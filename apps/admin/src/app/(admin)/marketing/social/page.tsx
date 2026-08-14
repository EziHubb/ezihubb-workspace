'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2, Settings, Info, Package, Sparkles, X, Globe, AtSign, ImageIcon } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { SocialAccountSettingsModal } from '../../../../components/marketing/SocialAccountSettingsModal';
import { CreatePostModal } from '../../../../components/marketing/CreatePostModal';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate } from '../../../../lib/fmt';

interface Listing { id: string; name: string; slug: string; price: number; imageUrl: string | null }
interface Sale { id: string; label: string; type: string; value: number }
interface SocialPost { id: string; content: string; imageUrl: string | null; platforms: string[]; createdAt: string }

const PLATFORM_ICON: Record<string, React.ElementType> = { FACEBOOK: Globe, PINTEREST: ImageIcon, X: AtSign };

const GUIDELINES: { platform: string; tips: string[] }[] = [
  { platform: 'Facebook', tips: [
    'Post when your audience is most active — evenings and weekends tend to perform well.',
    'Use a clear, high-resolution image — Facebook favors visual content.',
    'Keep captions concise and end with a question to encourage comments.',
  ] },
  { platform: 'X', tips: [
    'Keep it short — punchy captions get more reposts.',
    'Use 1-2 relevant hashtags, not more.',
    'Tag your shop link so people can click straight through.',
  ] },
  { platform: 'Pinterest', tips: [
    'Vertical images (2:3 ratio) perform best.',
    'Write a keyword-rich description — Pinterest is a search engine too.',
    'Coming soon to this platform.',
  ] },
];

function GuidelinesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[420px] h-full bg-surface overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 className="font-bold text-secondary text-base">Guidelines and tips</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-6">
          {GUIDELINES.map((g) => (
            <div key={g.platform}>
              <p className="text-sm font-bold text-secondary mb-2">{g.platform}</p>
              <ul className="space-y-1.5 text-xs text-muted list-disc pl-4">
                {g.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SocialMediaPage() {
  const qc = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  const { data: content } = useQuery({
    queryKey: ['social-content'],
    queryFn:  () => api.get<{ newestListings: Listing[]; activeSales: Sale[] }>(API_ROUTES.ADMIN.SOCIAL_CONTENT),
  });

  const { data: posts } = useQuery({
    queryKey: ['social-posts'],
    queryFn:  () => api.get<SocialPost[]>(API_ROUTES.ADMIN.SOCIAL_POSTS),
  });

  const heroSale = content?.activeSales[0];
  const heroListing = content?.newestListings[0];

  return (
    <>
      <AdminPageHeader
        title="Social media"
        subtitle="Share your shop's newest listings and sales"
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setGuidelinesOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 hover:text-primary transition-colors">
              <Info className="w-4 h-4" /> Guidelines & tips
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 hover:text-primary transition-colors">
              <Settings className="w-4 h-4" /> Account settings
            </button>
          </div>
        }
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-card border border-border p-6 mb-8 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <Share2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-secondary">
            {heroSale ? `Share your promotion: ${heroSale.label}` : heroListing ? `Share your newest listing: ${heroListing.name}` : 'Share your shop'}
          </h2>
          <p className="text-sm text-muted mt-1">Turn your shop's best moments into posts your followers will love.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors shrink-0"
        >
          Create post
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* My newest listings */}
        <div>
          <p className="text-sm font-bold text-secondary mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> My newest listings</p>
          {!content || content.newestListings.length === 0 ? (
            <p className="text-sm text-muted italic">No listings yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {content.newestListings.map((l) => (
                <div key={l.id} className="bg-surface rounded-card border border-border overflow-hidden group">
                  {l.imageUrl ? <img src={l.imageUrl} alt={l.name} className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-muted/10" />}
                  <div className="p-2">
                    <p className="text-[11px] font-medium text-secondary truncate">{l.name}</p>
                    <p className="text-[10px] text-muted">${l.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales or promotions */}
        <div>
          <p className="text-sm font-bold text-secondary mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Sales or promotions</p>
          {!content || content.activeSales.length === 0 ? (
            <p className="text-sm text-muted italic">No active sales or promo codes.</p>
          ) : (
            <div className="space-y-2">
              {content.activeSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-surface rounded-card border border-border">
                  <span className="text-sm text-secondary">{s.label}</span>
                  <span className="text-xs font-bold text-primary">{s.type === 'PERCENTAGE' ? `${s.value}% off` : `$${s.value} off`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post history */}
      <div>
        <p className="text-sm font-bold text-secondary mb-3">Your posts</p>
        {!posts || posts.length === 0 ? (
          <div className="bg-surface rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
            No posts yet — create your first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-surface rounded-card border border-border">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" /> : <div className="w-12 h-12 rounded bg-muted/10 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-secondary truncate">{p.content}</p>
                  <p className="text-[11px] text-muted mt-0.5">{fmtDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.platforms.map((pl) => {
                    const Icon = PLATFORM_ICON[pl] ?? Share2;
                    return <Icon key={pl} className="w-3.5 h-3.5 text-muted" />;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {settingsOpen && <SocialAccountSettingsModal onClose={() => setSettingsOpen(false)} />}
      {createOpen && (
        <CreatePostModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['social-posts'] })}
        />
      )}
      {guidelinesOpen && <GuidelinesPanel onClose={() => setGuidelinesOpen(false)} />}
    </>
  );
}
