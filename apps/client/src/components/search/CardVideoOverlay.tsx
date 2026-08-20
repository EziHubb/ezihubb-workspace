'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Only one card video is ever audible-or-playing at a time.
 *
 * Module scope on purpose: a grid can hold 48 cards, each with its own state,
 * and there is no common React parent that all of them share cheaply. Without
 * this, dragging the pointer across a row leaves a trail of clips all decoding
 * at once — which on a mid-range laptop is enough to drop the whole grid's
 * scroll frame rate, not just make a mess.
 */
let nowPlaying: HTMLVideoElement | null = null;

function claimPlayback(el: HTMLVideoElement) {
  if (nowPlaying && nowPlaying !== el) {
    nowPlaying.pause();
    nowPlaying.currentTime = 0;
  }
  nowPlaying = el;
}

function releasePlayback(el: HTMLVideoElement) {
  if (nowPlaying === el) nowPlaying = null;
}

/** True on devices with a real pointer, where hover is a meaningful signal. */
function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHasHover(mq.matches);
    const on = (e: MediaQueryListEvent) => setHasHover(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return hasHover;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Wait this long before a hover counts as intent to watch. */
const HOVER_INTENT_MS = 250;

interface CardVideoOverlayProps {
  src: string;
  /** Extracted frame. Undefined when the clip has none stored. */
  poster?: string;
  /** The card is hovered. Ignored on touch devices, which never hover. */
  hovered: boolean;
}

/**
 * A muted, looping preview that sits on top of the card image.
 *
 * Two ways in, deliberately not the same one:
 *
 *  - **Pointer devices** get hover-autoplay. This is OUR addition, not
 *    something copied from the reference — do not remove it as drift.
 *  - **Touch devices and reduced-motion users** get an explicit play button,
 *    because hover does not exist for the former and autoplay is unwanted by
 *    the latter. Without it the feature would simply be absent on phones.
 *
 * The two never collide: while a hover preview is playing, the button is not
 * rendered, so there is never a "play" control sitting on top of something
 * already playing.
 *
 * Nothing is fetched until one of those two fires. `preload="none"` plus a
 * deferred `src` means a grid of 48 cards costs zero video bytes on load; the
 * bytes arrive only for the clip somebody actually pointed at.
 */
export function CardVideoOverlay({ src, poster, hovered }: CardVideoOverlayProps) {
  const t = useTranslations('product.gallery');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasHover = useHasHover();
  const reducedMotion = usePrefersReducedMotion();

  // Set once we decide to load. Until then the <video> has no src at all, so
  // the browser opens no connection for it.
  const [loadSrc, setLoadSrc] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);

  // Autoplay on hover only where hover exists and motion is welcome. Manual
  // play overrides both — someone who pressed play has asked for it.
  const wantsPlay = manual || (hasHover && !reducedMotion && hovered);

  // Debounce the hover so sweeping the pointer across a row does not start
  // (and immediately abort) a fetch per card on the way past.
  useEffect(() => {
    if (!wantsPlay || failed) return;
    const id = setTimeout(() => setLoadSrc(true), manual ? 0 : HOVER_INTENT_MS);
    return () => clearTimeout(id);
  }, [wantsPlay, failed, manual]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !loadSrc || failed) return;

    if (wantsPlay) {
      claimPlayback(el);
      // A rejected play() is normal, not exceptional: autoplay policy can
      // refuse, and the pointer may have left before the promise settled.
      // Staying on the still image is the correct outcome either way.
      el.play().catch(() => undefined);
    } else {
      el.pause();
      el.currentTime = 0;
      releasePlayback(el);
      setReady(false);
    }
  }, [wantsPlay, loadSrc, failed]);

  // Reset the manual override when the pointer leaves, so the card does not
  // keep playing indefinitely after a tap-then-move-away on a hybrid device.
  useEffect(() => {
    if (!hovered && hasHover) setManual(false);
  }, [hovered, hasHover]);

  useEffect(() => {
    const el = videoRef.current;
    return () => { if (el) releasePlayback(el); };
  }, []);

  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    // The card is wrapped in a link — a tap on the play button must not
    // navigate to the product page instead of playing.
    e.preventDefault();
    e.stopPropagation();
    setManual(true);
  }, []);

  // A clip that will not load leaves no trace: no error icon, no empty box,
  // just the product image the card would have shown anyway.
  if (failed) return null;

  const showButton = !manual && (!hasHover || reducedMotion);

  return (
    <>
      {loadSrc && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
          className={[
            'absolute inset-0 w-full h-full object-cover pointer-events-none',
            // Fades in only once it can actually play, so the swap from image
            // to video never shows a black frame or a half-loaded flash.
            'transition-opacity duration-300',
            ready && wantsPlay ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      )}

      {showButton && (
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={t('playVideo')}
          className="absolute bottom-2.5 left-2.5 z-10 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
        </button>
      )}
    </>
  );
}
