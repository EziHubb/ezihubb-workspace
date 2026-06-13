'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Star, Gift } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchStatus = 'PENDING' | 'MATCHED' | 'REVEALED' | 'RATED';

interface BlindMatchRequest {
  id:     string;
  status: MatchStatus;
}

interface BlindMatchMystery {
  id:     string;
  status: MatchStatus;
  product?: {
    id:       string;
    name:     string;
    slug:     string;
    imageUrl: string | null;
    basePrice: number;
  } | null;
  rating?: number | null;
}

// ── Interest values ───────────────────────────────────────────────────────────

const INTEREST_VALUES = [
  { value: 'art',     emoji: '🎨' },
  { value: 'home',    emoji: '🏠' },
  { value: 'nature',  emoji: '🌿' },
  { value: 'fashion', emoji: '👗' },
  { value: 'food',    emoji: '🍰' },
  { value: 'travel',  emoji: '✈️' },
  { value: 'books',   emoji: '📚' },
  { value: 'music',   emoji: '🎵' },
  { value: 'games',   emoji: '🎮' },
];

// ── Pulsing mystery box ───────────────────────────────────────────────────────

function MysteryBox({
  status,
  pendingTitle,
  pendingSub,
  checkingMsg,
  matchedTitle,
  matchedSub,
}: {
  status:       MatchStatus;
  pendingTitle: string;
  pendingSub:   string;
  checkingMsg:  string;
  matchedTitle: string;
  matchedSub:   string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div
        className={[
          'relative w-32 h-32 rounded-2xl flex items-center justify-center',
          status === 'PENDING'
            ? 'bg-primary/10 border-2 border-primary/30 animate-pulse'
            : 'bg-primary/20 border-2 border-primary',
        ].join(' ')}
      >
        <span className="text-6xl select-none" aria-hidden>?</span>
        {status === 'PENDING' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-ping" />
        )}
      </div>

      <div className="text-center space-y-1.5">
        {status === 'PENDING' && (
          <>
            <p className="font-bold text-secondary text-lg">{pendingTitle}</p>
            <p className="text-sm text-muted">{pendingSub}</p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-muted">{checkingMsg}</span>
            </div>
          </>
        )}
        {status === 'MATCHED' && (
          <>
            <p className="font-bold text-secondary text-lg">{matchedTitle}</p>
            <p className="text-sm text-muted">{matchedSub}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
          className="p-0.5"
        >
          <Star
            className={[
              'w-6 h-6 transition-colors',
              (hovered || value) >= n ? 'fill-warning text-warning' : 'text-border',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type UIState = 'request' | 'pending' | 'matched' | 'revealed' | 'rated';

export default function BlindMatchPage() {
  const locale = useLocale();
  const t      = useTranslations('blindMatch');
  const token  = useAuthStore((s) => s.accessToken);

  const [uiState,          setUiState]          = useState<UIState>('request');
  const [matchId,          setMatchId]          = useState<string | null>(null);
  const [mystery,          setMystery]          = useState<BlindMatchMystery | null>(null);
  const [revealed,         setRevealed]         = useState(false);
  const [revealAnim,       setRevealAnim]       = useState(false);
  const [rating,           setRating]           = useState(0);
  const [ratingSubmitted,  setRatingSubmitted]  = useState(false);

  const [budget,      setBudget]      = useState(50);
  const [interests,   setInterests]   = useState<string[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const data = await apiClient.get<BlindMatchMystery>(`/blind-match/${id}/mystery`, {
        token: token ?? undefined,
      });
      setMystery(data);

      if (data.status === 'MATCHED') {
        setUiState('matched');
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      } else if (data.status === 'REVEALED') {
        setUiState('revealed');
        setRevealed(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      } else if (data.status === 'RATED') {
        setUiState('rated');
        setRevealed(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch {
      /* non-fatal polling error */
    }
  }, [token]);

  useEffect(() => {
    if (uiState === 'pending' && matchId) {
      pollRef.current = setInterval(() => pollStatus(matchId), 10_000);
      pollStatus(matchId);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [uiState, matchId, pollStatus]);

  const toggleInterest = (v: string) => {
    setInterests((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiClient.post<BlindMatchRequest>(
        '/blind-match/request',
        { budget, interests },
        { token: token ?? undefined },
      );
      setMatchId(res.id);
      setUiState('pending');
    } catch {
      setSubmitError(t('submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async () => {
    if (!matchId) return;
    try {
      const data = await apiClient.post<BlindMatchMystery>(
        `/blind-match/${matchId}/reveal`,
        {},
        { token: token ?? undefined },
      );
      setMystery(data);
      setRevealAnim(true);
      setTimeout(() => { setRevealed(true); setUiState('revealed'); }, 600);
    } catch {
      setRevealAnim(true);
      setTimeout(() => { setRevealed(true); setUiState('revealed'); }, 600);
    }
  };

  const handleRate = async () => {
    if (!matchId || !rating) return;
    try {
      await apiClient.post(
        `/blind-match/${matchId}/rate`,
        { rating },
        { token: token ?? undefined },
      );
      setRatingSubmitted(true);
      setUiState('rated');
    } catch {
      setRatingSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">

        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>
          <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
        </div>

        {/* ── REQUEST FORM ──────────────────────────────────────────────────── */}
        {uiState === 'request' && (
          <form onSubmit={handleRequest} className="space-y-6">

            <div className="bg-surface border border-border rounded-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-secondary text-sm">{t('budget')}</label>
                <span className="font-bold text-primary tabular-nums text-lg">${budget}</span>
              </div>
              <input
                type="range" min={10} max={500} step={5}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
                aria-label={t('budget')}
              />
              <div className="flex justify-between text-xs text-muted">
                <span>$10</span><span>$500</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5 space-y-4">
              <label className="font-semibold text-secondary text-sm block">
                {t('interests')} <span className="text-muted font-normal">{t('interestsSub')}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {INTEREST_VALUES.map((opt) => {
                  const selected = interests.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleInterest(opt.value)}
                      aria-pressed={selected}
                      className={[
                        'flex flex-col items-center gap-1.5 border rounded-card p-3 text-center transition-all text-xs font-medium',
                        selected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-secondary hover:border-primary/40',
                      ].join(' ')}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      {t(`interestLabels.${opt.value}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && <p className="text-xs text-error text-center">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting || interests.length === 0}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wide rounded-button py-4 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? t('submitting') : t('submit')}
            </button>
          </form>
        )}

        {/* ── PENDING ───────────────────────────────────────────────────────── */}
        {uiState === 'pending' && (
          <div className="bg-surface border border-border rounded-card p-8">
            <MysteryBox
              status="PENDING"
              pendingTitle={t('pendingTitle')}
              pendingSub={t('pendingSub')}
              checkingMsg={t('checkingMsg')}
              matchedTitle={t('matchedTitle')}
              matchedSub={t('matchedSub')}
            />
          </div>
        )}

        {/* ── MATCHED ───────────────────────────────────────────────────────── */}
        {uiState === 'matched' && (
          <div className="bg-surface border border-border rounded-card p-8 space-y-6">
            <MysteryBox
              status="MATCHED"
              pendingTitle={t('pendingTitle')}
              pendingSub={t('pendingSub')}
              checkingMsg={t('checkingMsg')}
              matchedTitle={t('matchedTitle')}
              matchedSub={t('matchedSub')}
            />
            <button
              type="button"
              onClick={handleReveal}
              className={[
                'w-full font-bold text-sm uppercase tracking-wide rounded-button py-4 transition-all',
                revealAnim
                  ? 'bg-primary/30 text-primary'
                  : 'bg-primary hover:bg-primary-dark text-white',
              ].join(' ')}
            >
              {revealAnim ? t('revealing') : t('revealBtn')}
            </button>
          </div>
        )}

        {/* ── REVEALED ──────────────────────────────────────────────────────── */}
        {(uiState === 'revealed' || uiState === 'rated') && mystery?.product && (
          <div
            className={[
              'bg-surface border border-border rounded-card overflow-hidden transition-all duration-500',
              revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
            ].join(' ')}
          >
            {mystery.product.imageUrl && (
              <div className="relative w-full aspect-[16/9] bg-background">
                <Image
                  src={mystery.product.imageUrl}
                  alt={mystery.product.name}
                  fill
                  sizes="(max-width: 512px) 100vw, 512px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-0.5">
                    {t('yourMatch')}
                  </p>
                  <h2 className="font-display text-xl font-bold text-secondary line-clamp-2">
                    {mystery.product.name}
                  </h2>
                  <p className="text-lg font-bold text-primary tabular-nums mt-1">
                    ${mystery.product.basePrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <Link
                href={`/${locale}/products/${mystery.product.slug}`}
                className="block w-full bg-primary hover:bg-primary-dark text-white font-bold text-sm uppercase tracking-wide rounded-button py-3 text-center transition-colors"
              >
                {t('viewProduct')}
              </Link>

              {uiState === 'revealed' && !ratingSubmitted && (
                <div className="border-t border-border pt-5 space-y-3">
                  <p className="text-sm font-medium text-secondary">{t('rateMatch')}</p>
                  <StarRating value={rating} onChange={setRating} />
                  {rating > 0 && (
                    <button
                      type="button"
                      onClick={handleRate}
                      className="text-sm font-semibold text-primary hover:underline transition-colors"
                    >
                      {t('submitRating')}
                    </button>
                  )}
                </div>
              )}

              {(uiState === 'rated' || ratingSubmitted) && (
                <div className="border-t border-border pt-4 flex items-center gap-2">
                  <span className="text-sm text-muted">{t('thanksForRating')}</span>
                  {mystery.rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: mystery.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
