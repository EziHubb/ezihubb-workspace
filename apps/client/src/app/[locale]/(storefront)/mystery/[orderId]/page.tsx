'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Gift, Clock, Copy, Check, Star, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';

interface MysteryOrder {
  id:           string;
  status:       'SHIPPED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REVEALED';
  niche:        string;
  estimatedMin: string;
  estimatedMax: string;
  product?: {
    name:      string;
    imageUrl:  string | null;
    basePrice: number;
    slug:      string;
  } | null;
  rating?: number | null;
  discountCode?: string | null;
}

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
              'w-7 h-7 transition-colors',
              (hovered || value) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-white/20',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm text-white transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

const STAGE_LABELS: Record<string, string> = {
  SHIPPED:           'Package shipped',
  IN_TRANSIT:        'On the way',
  OUT_FOR_DELIVERY:  'Out for delivery',
  DELIVERED:         'Delivered',
  REVEALED:          'Revealed',
};

export default function MysteryOrderPage() {
  const params       = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const locale       = useLocale();

  const [order,          setOrder]          = useState<MysteryOrder | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [revealed,       setRevealed]       = useState(false);
  const [rating,         setRating]         = useState(0);
  const [ratingDone,     setRatingDone]     = useState(false);
  const [submittingRate, setSubmittingRate] = useState(false);
  const [shareCopied,    setShareCopied]    = useState(false);

  useEffect(() => {
    apiClient.get<MysteryOrder>(`/blind-match/mystery/${params.orderId}`)
      .then((data) => {
        setOrder(data);
        if (data.status === 'REVEALED' || data.rating != null || searchParams.get('reveal') === 'true') {
          setRevealed(true);
        }
      })
      .catch(() => setError('Mystery gift not found.'))
      .finally(() => setLoading(false));
  }, [params.orderId, searchParams]);

  const handleReveal = () => setRevealed(true);

  const handleRate = async () => {
    if (!rating) return;
    setSubmittingRate(true);
    try {
      await apiClient.post(`/blind-match/${params.orderId}/rate`, { rating });
      setRatingDone(true);
    } catch {
      setRatingDone(true);
    } finally {
      setSubmittingRate(false);
    }
  };

  const copyShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-white/40" />
        </div>
        <h1 className="text-xl font-bold text-white">Mystery gift not found</h1>
        <p className="text-white/50 text-sm">This link may be invalid or the gift has already been revealed.</p>
        <Link href={`/${locale}/blind-match`} className="text-primary underline text-sm">
          Send your own mystery gift →
        </Link>
      </div>
    );
  }

  const stages  = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const stageIdx = stages.indexOf(order.status);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="max-w-md mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">Mystery Gift</p>
          <h1 className="text-2xl font-bold">Someone sent you a mystery gift!</h1>
          <p className="text-white/50 text-sm">A perfect surprise is on its way to you</p>
        </div>

        {!revealed ? (
          <>
            {/* Mystery box */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-44 h-44 border-2 border-primary rounded-2xl flex items-center justify-center bg-primary/10 animate-bounce">
                <span className="text-7xl font-black text-primary select-none">?</span>
              </div>
              <p className="text-white/40 text-xs">Shake your screen... just kidding</p>
            </div>

            {/* Hint */}
            <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl p-5 space-y-2">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Hint</p>
              <p className="text-white text-sm">
                It&apos;s something perfect for a <span className="text-primary font-semibold">{order.niche}</span> lover
              </p>
            </div>

            {/* Tracking stages */}
            <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/40" />
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Estimated delivery</p>
              </div>
              <p className="text-white font-semibold">
                {new Date(order.estimatedMin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(order.estimatedMax).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={[
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      i <= stageIdx ? 'border-primary bg-primary' : 'border-white/20 bg-transparent',
                    ].join(' ')}>
                      {i <= stageIdx && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={['text-sm', i <= stageIdx ? 'text-white' : 'text-white/30'].join(' ')}>
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Share hype */}
            <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold">Build the anticipation</p>
              <p className="text-white/50 text-xs">Share your mystery gift link before it arrives</p>
              <div className="flex gap-2 flex-wrap">
                <CopyButton text={window.location.href} label="Copy link" />
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Someone sent me a mystery gift and I have no idea what it is 🎁 ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/30 rounded-xl text-sm text-white transition-colors"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>

            {order.status === 'DELIVERED' && (
              <button
                type="button"
                onClick={handleReveal}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Reveal my gift!
              </button>
            )}
          </>
        ) : (
          <>
            {/* Revealed */}
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <Gift className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Your mystery gift is revealed!</h2>
            </div>

            {order.product && (
              <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl overflow-hidden">
                {order.product.imageUrl && (
                  <div className="relative w-full aspect-video bg-black">
                    <Image
                      src={order.product.imageUrl}
                      alt={order.product.name}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-5 space-y-3">
                  <h3 className="font-bold text-lg">{order.product.name}</h3>
                  <p className="text-primary font-bold text-xl">${order.product.basePrice.toFixed(2)}</p>
                  <Link
                    href={`/${locale}/products/${order.product.slug}`}
                    className="block w-full text-center bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wide transition-colors"
                  >
                    View product
                  </Link>
                </div>
              </div>
            )}

            {!ratingDone ? (
              <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl p-5 space-y-4">
                <p className="font-semibold">How surprised were you?</p>
                <StarRating value={rating} onChange={setRating} />
                <button
                  type="button"
                  onClick={handleRate}
                  disabled={!rating || submittingRate}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submittingRate && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit rating
                </button>
              </div>
            ) : (
              <div className="bg-[#2D2D2D] border border-white/10 rounded-2xl p-5 text-center">
                <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="font-semibold">Thanks for rating!</p>
              </div>
            )}

            {order.discountCode && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2">
                <p className="font-semibold text-amber-300 text-sm">Pass on the kindness 💛</p>
                <p className="text-white/70 text-xs">
                  You have a <strong className="text-white">10% discount</strong> to send a mystery gift to someone else.
                  Use code at checkout:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-amber-500/20 text-amber-200 px-3 py-1.5 rounded-lg font-mono text-sm">
                    {order.discountCode}
                  </code>
                  <button
                    type="button"
                    onClick={copyShare}
                    className="text-amber-300 hover:text-amber-100 transition-colors"
                  >
                    {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <Link
                  href={`/${locale}/blind-match`}
                  className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wide transition-colors mt-2"
                >
                  Send a mystery gift →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
