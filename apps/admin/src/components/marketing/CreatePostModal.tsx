'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Package, Sparkles, FileText, Globe, AtSign, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

type Platform = 'FACEBOOK' | 'PINTEREST' | 'X';
type ContentChoice = 'listing' | 'sale' | 'blank';

interface Listing { id: string; name: string; slug: string; price: number; imageUrl: string | null }
interface Sale { id: string; label: string; type: string; value: number }
interface Connection { platform: Platform; status: 'CONNECTED' | 'DISCONNECTED' }

const PLATFORM_META: Record<Platform, { label: string; icon: React.ElementType }> = {
  FACEBOOK:  { label: 'Facebook',  icon: Globe },
  PINTEREST: { label: 'Pinterest', icon: ImageIcon },
  X:         { label: 'X',         icon: AtSign },
};

const STEP_LABELS = ['Choose content', 'Choose networks', 'Customize', 'Review'];

interface CreatePostModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function CreatePostModal({ onClose, onSaved }: CreatePostModalProps) {
  const [step, setStep] = useState(1);
  const [content, setContent] = useState<{ listings: Listing[]; sales: Sale[] } | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  const [contentChoice, setContentChoice] = useState<ContentChoice>('listing');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ newestListings: Listing[]; activeSales: Sale[] }>(API_ROUTES.ADMIN.SOCIAL_CONTENT)
      .then((res) => {
        setContent({ listings: res.newestListings, sales: res.activeSales });
        setSelectedListing(res.newestListings[0] ?? null);
        setSelectedSale(res.activeSales[0] ?? null);
      })
      .catch(() => setContent({ listings: [], sales: [] }));
    api.get<Connection[]>(API_ROUTES.ADMIN.SOCIAL_CONNECTIONS).then(setConnections).catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const connectedPlatforms = connections.filter((c) => c.status === 'CONNECTED').map((c) => c.platform);

  const defaultCaption = useMemo(() => {
    if (contentChoice === 'listing' && selectedListing) return `Check out ${selectedListing.name}! $${selectedListing.price.toFixed(2)}`;
    if (contentChoice === 'sale' && selectedSale) return `${selectedSale.label} — don't miss it!`;
    return '';
  }, [contentChoice, selectedListing, selectedSale]);

  useEffect(() => { if (step === 3 && !caption) setCaption(defaultCaption); }, [step, defaultCaption, caption]);

  const imageUrl = contentChoice === 'listing' ? selectedListing?.imageUrl ?? undefined : undefined;

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const canProceed =
    (step === 1 && (contentChoice === 'blank' || (contentChoice === 'listing' && selectedListing) || (contentChoice === 'sale' && selectedSale))) ||
    (step === 2 && platforms.length > 0) ||
    (step === 3 && caption.trim().length > 0) ||
    step === 4;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(API_ROUTES.ADMIN.SOCIAL_POSTS, { content: caption, imageUrl, platforms });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-surface rounded-card border border-border shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-bold text-secondary text-base">Create post</h2>
            <p className="text-xs text-muted mt-0.5">Step {step} of 4 — {STEP_LABELS[step - 1]}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 min-h-[280px]">
          {/* Step 1: choose content */}
          {step === 1 && content && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['listing', 'sale', 'blank'] as ContentChoice[]).map((c) => (
                  <button key={c} type="button" onClick={() => setContentChoice(c)}
                    className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-card border-2 text-xs font-semibold transition-all ${contentChoice === c ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40'}`}>
                    {c === 'listing' && <Package className="w-4 h-4" />}
                    {c === 'sale' && <Sparkles className="w-4 h-4" />}
                    {c === 'blank' && <FileText className="w-4 h-4" />}
                    {c === 'listing' ? 'Latest listing' : c === 'sale' ? 'Active sale' : 'Blank post'}
                  </button>
                ))}
              </div>

              {contentChoice === 'listing' && (
                content.listings.length === 0 ? <p className="text-sm text-muted italic">No listings yet.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {content.listings.map((l) => (
                      <button key={l.id} type="button" onClick={() => setSelectedListing(l)}
                        className={`p-2 rounded-card border-2 text-left transition-all ${selectedListing?.id === l.id ? 'border-primary' : 'border-border'}`}>
                        {l.imageUrl ? <img src={l.imageUrl} alt={l.name} className="w-full aspect-square object-cover rounded mb-1" /> : <div className="w-full aspect-square bg-muted/10 rounded mb-1" />}
                        <p className="text-[11px] font-medium text-secondary truncate">{l.name}</p>
                      </button>
                    ))}
                  </div>
                )
              )}

              {contentChoice === 'sale' && (
                content.sales.length === 0 ? <p className="text-sm text-muted italic">No active sales or promo codes.</p> : (
                  <div className="space-y-2">
                    {content.sales.map((s) => (
                      <button key={s.id} type="button" onClick={() => setSelectedSale(s)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-card border-2 text-left transition-all ${selectedSale?.id === s.id ? 'border-primary' : 'border-border'}`}>
                        <span className="text-sm text-secondary">{s.label}</span>
                        <span className="text-xs font-semibold text-primary">{s.type === 'PERCENTAGE' ? `${s.value}%` : `$${s.value}`}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Step 2: choose networks */}
          {step === 2 && (
            <div className="space-y-2">
              {connectedPlatforms.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-button px-3 py-2 mb-2">
                  No social accounts connected yet — connect one from Social account settings first.
                </p>
              )}
              {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
                const meta = PLATFORM_META[p];
                const Icon = meta.icon;
                const connected = connectedPlatforms.includes(p);
                return (
                  <label key={p} className={`flex items-center gap-3 p-3 rounded-card border cursor-pointer transition-colors ${!connected ? 'opacity-40 cursor-not-allowed' : platforms.includes(p) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="checkbox" disabled={!connected} checked={platforms.includes(p)} onChange={() => togglePlatform(p)} className="w-4 h-4 accent-primary rounded" />
                    <Icon className="w-4 h-4 text-muted" />
                    <span className="text-sm text-secondary">{meta.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Step 3: customize */}
          {step === 3 && (
            <div className="space-y-3">
              {imageUrl && <img src={imageUrl} alt="" className="w-full aspect-video object-cover rounded-card" />}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                maxLength={500}
                className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Write your caption…"
              />
              <p className="text-xs text-muted text-right">{caption.length}/500</p>
            </div>
          )}

          {/* Step 4: review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-background border border-border rounded-card p-4">
                {imageUrl && <img src={imageUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-3" />}
                <p className="text-sm text-secondary whitespace-pre-wrap">{caption}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {platforms.map((p) => (
                  <span key={p} className="text-xs font-semibold px-2.5 py-1 rounded-pill bg-primary/10 text-primary">{PLATFORM_META[p].label}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted/70 italic">
                Saving adds this to your post history for reference — it does not publish to the network automatically.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canProceed}
              className="flex items-center gap-1 px-5 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
