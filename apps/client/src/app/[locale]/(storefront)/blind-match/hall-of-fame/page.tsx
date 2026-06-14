'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Camera, Heart, Star, Upload, Check, Loader2, X, Sparkles } from 'lucide-react';
import { apiClient } from '@mlh/api-client';

interface UgcEntry {
  id:         string;
  niche:      string;
  gifterName: string;
  gifterCity: string;
  caption:    string;
  rating:     number;
  heartCount: number;
  imageUrl:   string | null;
}

function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star
            className={[
              'w-6 h-6 transition-colors',
              (hovered || value) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-border',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  );
}

function UgcCard({ entry }: { entry: UgcEntry }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="break-inside-avoid bg-surface border border-border rounded-2xl overflow-hidden mb-4">
      <div className="bg-muted/5 h-48 flex items-center justify-center relative">
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt={entry.caption} className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-10 h-10 text-muted/30" />
        )}
      </div>
      <div className="p-4 space-y-2">
        <span className="inline-block bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
          {entry.niche}
        </span>
        {entry.caption && (
          <p className="text-sm text-secondary line-clamp-3">&quot;{entry.caption}&quot;</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted">
            {entry.gifterName} · {entry.gifterCity}
          </p>
          <button
            type="button"
            onClick={() => setLiked((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
          >
            <Heart className={['w-4 h-4', liked ? 'fill-red-400 text-red-400' : ''].join(' ')} />
            {entry.heartCount + (liked ? 1 : 0)}
          </button>
        </div>
        <div className="flex gap-0.5 pt-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={['w-3 h-3', n <= entry.rating ? 'fill-yellow-400 text-yellow-400' : 'text-border'].join(' ')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HallOfFamePage() {
  const locale   = useLocale();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [entries,       setEntries]       = useState<UgcEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [file,          setFile]          = useState<File | null>(null);
  const [caption,       setCaption]       = useState('');
  const [rating,        setRating]        = useState(0);
  const [consent,       setConsent]       = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [dragOver,      setDragOver]      = useState(false);

  useState(() => {
    apiClient.get<UgcEntry[]>('/blind-match/hall-of-fame')
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('image/')) setFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || !rating) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      form.append('caption', caption);
      form.append('rating', String(rating));
      await fetch('/api/v1/blind-match/ugc', { method: 'POST', body: form });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Community</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-secondary">Blind Match Hall of Fame</h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            The most delightful reactions from our community — real people, real surprises
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : entries.length > 0 ? (
          <div className="columns-2 md:columns-3 gap-4 mb-16">
            {entries.map((entry) => (
              <UgcCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4 mb-16">
            <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-muted/40" />
            </div>
            <p className="text-secondary font-semibold">No reactions yet</p>
            <p className="text-muted text-sm">Be the first to share your mystery gift experience</p>
            <Link
              href={`/${locale}/blind-match`}
              className="inline-block bg-primary text-white font-bold text-sm px-6 py-3 rounded-button hover:bg-primary/90 transition-colors"
            >
              Send a mystery gift
            </Link>
          </div>
        )}

        {/* Upload section */}
        <div className="bg-surface border border-border rounded-2xl p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="font-bold text-secondary text-xl">Just received your blind gift?</h2>
            <p className="text-muted text-sm">Share your unboxing reaction and get featured in the Hall of Fame</p>
          </div>

          {!uploadOpen && !submitted && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-button transition-colors"
            >
              <Upload className="w-4 h-4" />
              Share my reaction
            </button>
          )}

          {submitted && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Submission received!</p>
                <p className="text-green-600 text-xs">We&apos;ll review your post and publish it within 24 hours.</p>
              </div>
            </div>
          )}

          {uploadOpen && !submitted && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="space-y-1">
                    <Check className="w-8 h-8 text-primary mx-auto" />
                    <p className="text-sm font-semibold text-secondary">{file.name}</p>
                    <p className="text-xs text-muted">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-10 h-10 text-muted/40 mx-auto" />
                    <p className="text-sm text-secondary font-semibold">Upload reaction photo or video</p>
                    <p className="text-xs text-muted">Drag and drop or click to browse</p>
                  </div>
                )}
              </div>

              {/* Caption */}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Tell us what you thought when you opened the box..."
                rows={3}
                maxLength={300}
                className="w-full bg-background border border-border rounded-input px-3 py-2.5 text-sm text-secondary placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />

              {/* Star rating */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">How surprised were you?</label>
                <StarSelector value={rating} onChange={setRating} />
              </div>

              {/* Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-primary w-4 h-4"
                />
                <span className="text-xs text-muted leading-relaxed">
                  I agree to Maple Loom&apos;s community guidelines and allow my submission to be published on this page.
                  I understand my name, city, and photo may be visible publicly.
                </span>
              </label>

              <button
                type="submit"
                disabled={!consent || !rating || submitting}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-button transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit to Hall of Fame
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
