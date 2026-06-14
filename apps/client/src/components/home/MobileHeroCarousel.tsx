'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface Slide {
  id:       string;
  emoji:    string;
  label:    string;
  headline: string;
  sub:      string;
  ctaText:  string;
  ctaHref:  string;
  bg:       string;   // tailwind gradient or solid bg class
  pill?:    string;   // optional floating tag
}

const SLIDES: Slide[] = [
  {
    id:       'personalize',
    emoji:    '🎨',
    label:    'For them',
    headline: 'Gifts as unique as they are',
    sub:      'Add photos, names & personal messages',
    ctaText:  'Shop now',
    ctaHref:  '/search',
    bg:       'bg-gradient-to-br from-[#FFF5F0] to-[#FFECD2]',
    pill:     '50K+ Happy customers',
  },
  {
    id:       'flash',
    emoji:    '⚡',
    label:    'Flash Deal',
    headline: 'Today only — up to 40% off',
    sub:      'Limited stock. Timer resets at midnight.',
    ctaText:  'See deals',
    ctaHref:  '/flash-deals',
    bg:       'bg-gradient-to-br from-[#FFF5F5] to-[#FFE4E4]',
    pill:     '⏱ Ends tonight',
  },
  {
    id:       'giftfinder',
    emoji:    '🎁',
    label:    'AI Gift Finder',
    headline: 'Not sure what to give?',
    sub:      'Answer 5 questions, get the perfect gift',
    ctaText:  'Find a gift',
    ctaHref:  '/gift-finder',
    bg:       'bg-gradient-to-br from-[#FFFBEA] to-[#FEF9D7]',
    pill:     '30 seconds',
  },
  {
    id:       'blind',
    emoji:    '🎲',
    label:    'Mystery Gift',
    headline: 'Surprise someone special',
    sub:      'AI curates a mystery gift just for them',
    ctaText:  'Try Blind Match',
    ctaHref:  '/blind-match',
    bg:       'bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D]',
    pill:     '$2.99 curation',
  },
  {
    id:       'group',
    emoji:    '👥',
    label:    'Group Gifting',
    headline: 'Better together',
    sub:      'Pool contributions for a meaningful gift',
    ctaText:  'Start a pool',
    ctaHref:  '/gift-finder',
    bg:       'bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE]',
    pill:     'No minimums',
  },
  {
    id:       'coins',
    emoji:    '🪙',
    label:    'Earn Coins',
    headline: 'Shop. Earn. Redeem.',
    sub:      '100 coins = $1 off your next order',
    ctaText:  'Join free',
    ctaHref:  '/register',
    bg:       'bg-gradient-to-br from-[#FFFBEA] to-[#FEF3C7]',
    pill:     '10 pts per $1',
  },
];

const INTERVAL_MS = 4_500;

interface MobileHeroCarouselProps {
  locale: string;
}

export function MobileHeroCarousel({ locale }: MobileHeroCarouselProps) {
  const [current,  setCurrent]  = useState(0);
  const [paused,   setPaused]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(next, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next]);

  const slide = SLIDES[current];
  const isDark = slide.id === 'blind';

  return (
    <section
      className={`md:hidden relative overflow-hidden ${slide.bg} transition-colors duration-700`}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      aria-label="Featured highlights carousel"
    >
      <div className="px-5 pt-8 pb-6 min-h-[320px] flex flex-col justify-between">
        {/* Top row: label pill + emoji */}
        <div className="flex items-center justify-between mb-4">
          {slide.pill && (
            <span
              className={[
                'text-[11px] font-bold px-2.5 py-1 rounded-full',
                isDark ? 'bg-white/10 text-white' : 'bg-secondary/8 text-secondary',
              ].join(' ')}
            >
              {slide.pill}
            </span>
          )}
          <span className="text-4xl ml-auto" aria-hidden>{slide.emoji}</span>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <p
            className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-primary' : 'text-primary'}`}
          >
            {slide.label}
          </p>
          <h2
            className={`font-display text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-secondary'}`}
          >
            {slide.headline}
          </h2>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-muted'}`}>
            {slide.sub}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-5">
          <Link
            href={`/${locale}${slide.ctaHref}`}
            className={[
              'inline-flex items-center gap-1.5 font-bold text-sm px-5 py-3 rounded-full transition-colors',
              isDark
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-secondary text-white hover:bg-secondary/90',
            ].join(' ')}
          >
            {slide.ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 mt-5" role="tablist" aria-label="Carousel slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Slide ${i + 1}: ${s.label}`}
              onClick={() => { setCurrent(i); setPaused(true); setTimeout(() => setPaused(false), 6_000); }}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                i === current
                  ? `w-6 ${isDark ? 'bg-white' : 'bg-primary'}`
                  : `w-1.5 ${isDark ? 'bg-white/30' : 'bg-secondary/20'}`,
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
