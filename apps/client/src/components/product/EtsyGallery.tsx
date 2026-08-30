'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Heart, Flag, X, Play, Volume2, VolumeX, Video as VideoIcon } from 'lucide-react';
import { useWishlist, useWishlistToggle } from '@ezihubb/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import { safeArr } from '@ezihubb/utils';
import type { ProductDetailDto } from '@ezihubb/types';
import { useVariationPhoto } from './VariationPhotoContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://placehold.co/600x600/FFF5F0/E85D3F.png?text=No+Image';

// ── Unified media item (photo or short clip) ───────────────────────────────────

interface MediaItem {
  id:      string;
  type:    'image' | 'video';
  url:     string;
  altText?: string;
  /** Video only: extracted poster frame. Undefined when none was produced. */
  poster?: string;
}

function buildMediaItems(product: ProductDetailDto): MediaItem[] {
  const images = product.images?.length
    ? product.images.map((img) => ({ id: img.id, type: 'image' as const, url: img.url, altText: img.altText ?? undefined }))
    : [{ id: 'ph', type: 'image' as const, url: PLACEHOLDER, altText: product.name }];

  // Prefer the structured rows, which carry a real poster frame; fall back to
  // the deprecated flat array so a product whose payload predates the change
  // still shows its video, just without a poster.
  const structured = safeArr(product.videos);
  const videos = structured.length
    ? structured.map((v) => ({
        id:     v.id,
        type:   'video' as const,
        url:    v.url,
        // First entry is the full-size frame; the square one is for cards and
        // would letterbox badly at gallery size. Undefined when extraction
        // never ran, which the player treats as "no poster" rather than 404ing
        // on an empty string.
        poster: v.thumbnailUrls[0] ?? undefined,
      }))
    : safeArr(product.videoUrls).map((url, i) => ({
        id:     `video-${i}`,
        type:   'video' as const,
        url,
        poster: undefined,
      }));

  // Video slotted right after the primary (first) photo — engaging, but
  // doesn't disturb the seller's chosen primary image as the default slide
  // (that image is reused elsewhere: share links, search thumbnails, OG tags).
  return images.length > 0 ? [images[0], ...videos, ...images.slice(1)] : videos;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ── Video slide — autoplay muted+loop when active (clips are ≤10s, so this
//    stays lightweight); a tap unmutes, and reduced-motion users get a
//    static poster + explicit play button instead of autoplay. ────────────────

function VideoSlide({
  url,
  poster,
  active,
  className,
}: {
  url:       string;
  /** Extracted frame, painted while the clip buffers. Undefined = none stored. */
  poster?:   string;
  active:    boolean;
  className: string;
}) {
  const t = useTranslations('product.gallery');
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [muted, setMuted] = useState(true);
  const [playingManually, setPlayingManually] = useState(false);

  const shouldPlay = active && (!reducedMotion || playingManually);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (shouldPlay) el.play().catch(() => undefined);
    else el.pause();
  }, [shouldPlay]);

  // Reset the manual-play override once the slide goes out of view.
  useEffect(() => {
    if (!active) setPlayingManually(false);
  }, [active]);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        className="absolute inset-0 w-full h-full object-cover"
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={(e) => e.stopPropagation()}
      />

      {reducedMotion && !playingManually && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPlayingManually(true); }}
          aria-label={t('playVideo')}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-secondary ml-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {shouldPlay && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          className="absolute bottom-3 right-3 z-10 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// ── Thumbnail (photo or video-with-badge, lightweight preview only) ────────────

function MediaThumbnail({ item, className }: { item: MediaItem; className: string }) {
  if (item.type === 'video') {
    // `absolute inset-0` on the wrapper, not `relative`.
    //
    // Its only children are absolutely positioned, so as a `relative` box it
    // had no content to give it height and collapsed to zero — and `h-full`
    // inside a zero-high parent is zero. DevTools showed the poster loading
    // fine at 880x1280 and rendering at 73x0: the image was never the problem,
    // the box around it was.
    //
    // Filling the button gives the children a real box, the same one the image
    // branch gets by being the button's direct child. It still establishes a
    // containing block, since `absolute` is not `static`, so `inset-0` on the
    // img and on the scrim still resolves against it.
    return (
      <div className={`absolute inset-0 bg-black ${className}`}>
        {/* The extracted poster, when there is one. This used to mount a real
            <video preload="metadata"> purely to show a still frame, which made
            the browser open a connection and pull the container header for
            every clip in the strip just to paint a thumbnail. An <img> of a
            frame we already extracted costs a few KB instead.
            No poster (a clip predating extraction, or one whose frames would
            not decode) falls back to the old behaviour rather than showing an
            empty black box — preload="metadata" is enough to paint a frame. */}
        {item.poster ? (
          <Image
            src={item.poster}
            alt=""
            fill
            sizes="80px"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video src={item.url} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <VideoIcon className="w-4 h-4 text-white drop-shadow" />
        </span>
      </div>
    );
  }
  return (
    <Image
      src={item.url}
      alt={item.altText ?? ''}
      fill
      sizes="80px"
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
    />
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EtsyGalleryProps {
  product: ProductDetailDto;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EtsyGallery({ product }: EtsyGalleryProps) {
  const media = buildMediaItems(product);

  const [activeIndex,  setActiveIndex]  = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Bring forward the photo the shopper's chosen option is linked to.
  //
  // Resolved here rather than in the buy panel because only the gallery knows
  // where a photo sits in `media` — videos are interleaved, so a position
  // worked out from `product.images` alone would land on the wrong slide.
  //
  // A missing id is left alone on purpose: options without a linked photo
  // should not yank the gallery back to the first slide, which would undo
  // whatever the shopper was looking at.
  const { focusedImageId, focusSeq } = useVariationPhoto();
  useEffect(() => {
    if (!focusedImageId) return;
    const i = media.findIndex((m) => m.type === 'image' && m.id === focusedImageId);
    if (i >= 0) setActiveIndex(i);
  // Keyed on the counter, not the id: re-picking the option that is already
  // focused has to bring its photo back, and the id alone would not have moved.
  // `media` is rebuilt from props every render, so it cannot be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq]);

  const t        = useTranslations('product.gallery');
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();

  // ── Wishlist ──────────────────────────────────────────────────────────────────
  const isLoggedIn = Boolean(useAuthStore((s) => s.user));
  const isAuthReady    = useAuthStore((s) => s.isAuthReady);
  const { data: wishlistItems, isLoading: wishlistLoading } = useWishlist(isAuthReady && isLoggedIn);
  const wishlistToggle = useWishlistToggle();
  const isInWishlist   = wishlistItems?.some((item) => item.productId === product.id) ?? false;

  const handleWishlist = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    wishlistToggle(product.id, isInWishlist);
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goNext = useCallback(
    () => setActiveIndex((i) => Math.min(i + 1, media.length - 1)),
    [media.length],
  );
  const goPrev = useCallback(
    () => setActiveIndex((i) => Math.max(i - 1, 0)),
    [],
  );

  // Keyboard navigation (only when lightbox is open)
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'Escape')     setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, lightboxOpen]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  // Touch swipe
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) goNext(); else goPrev(); }
  };

  const activeItem = media[activeIndex] ?? media[0];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── PAGE GALLERY ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3">

        {/* Vertical thumbnail strip (desktop only) */}
        <div className="hidden lg:flex flex-col gap-2 w-[76px] flex-shrink-0 overflow-y-auto max-h-[640px] [&::-webkit-scrollbar]:hidden">
          {media.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={item.type === 'video' ? `View video ${i + 1}` : `View image ${i + 1}`}
              className={[
                'relative flex-shrink-0 aspect-square rounded-md overflow-hidden border-2 transition-colors',
                i === activeIndex
                  ? 'border-secondary'
                  : 'border-transparent hover:border-[#CCC]',
              ].join(' ')}
            >
              <MediaThumbnail item={item} className="" />
            </button>
          ))}
        </div>

        {/* Main image area */}
        <div className="flex-1 min-w-0">

          {/* Main media — click to open lightbox.

              Square, but capped by viewport HEIGHT rather than sized by column
              width. The gallery column is ~1000px wide on a large screen, so
              `aspect-square` alone made the image ~1000px tall inside a ~880px
              viewport — taller than the screen, so no amount of hiding the
              header could bring the whole thing into view.

              The cap goes on max-width, not max-height. With an aspect ratio
              set, capping the width lets the height follow and the box stays
              square; capping the height instead leaves the width alone and
              squashes it into a letterbox.

              180px covers the header plus the breadcrumb above it, so the
              image fits with the header still on screen — the state the page
              loads in. `mx-auto` centres it once it is narrower than its
              column. */}
          <div
            className={`relative aspect-square max-w-[calc(100vh-180px)] mx-auto rounded-2xl overflow-hidden bg-[#F5F1EB] ${activeItem.type === 'image' ? 'cursor-zoom-in' : ''}`}
            onClick={() => { if (activeItem.type === 'image') setLightboxOpen(true); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Wishlist button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleWishlist(); }}
              aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              disabled={isLoggedIn && wishlistLoading}
              className="absolute top-3 right-3 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-60 disabled:cursor-wait"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isInWishlist ? 'fill-red-500 text-red-500' : 'text-secondary'
                }`}
              />
            </button>

            {activeItem.type === 'video' ? (
              <VideoSlide url={activeItem.url} poster={activeItem.poster} active className="absolute inset-0 w-full h-full" />
            ) : (
              <Image
                src={activeItem.url}
                alt={activeItem.altText ?? product.name}
                fill
                priority={activeIndex === 0}
                sizes="(max-width: 1024px) 100vw, min(60vw, calc(100vh - 180px))"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* ◀ ▶ arrows */}
            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  disabled={activeIndex === 0}
                  aria-label={t('previous')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-secondary" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  disabled={activeIndex === media.length - 1}
                  aria-label={t('next')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-secondary" />
                </button>
              </>
            )}

            {/* Mobile dot indicators */}
            {media.length > 1 && (
              <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {media.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                    aria-label={`View item ${i + 1}`}
                    className={`rounded-full transition-all ${
                      i === activeIndex ? 'w-3 h-1.5 bg-secondary' : 'w-1.5 h-1.5 bg-white/70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mobile horizontal thumbnail strip */}
          {media.length > 1 && (
            <div className="lg:hidden flex gap-2 mt-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {media.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  aria-label={item.type === 'video' ? `View video ${i + 1}` : `View image ${i + 1}`}
                  className={[
                    'relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors',
                    i === activeIndex ? 'border-secondary' : 'border-transparent',
                  ].join(' ')}
                >
                  <MediaThumbnail item={item} className="" />
                </button>
              ))}
            </div>
          )}

          {/* Report link */}
          <button
            type="button"
            className="mt-3 text-xs text-muted hover:underline flex items-center gap-1"
          >
            <Flag className="w-3 h-3" />
            Report this item to EziHubb
          </button>
        </div>
      </div>

      {/* ── LIGHTBOX (photos only — a video's own controls already give the full-attention view) ── */}
      {lightboxOpen && activeItem.type === 'image' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-stretch"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={t('close')}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>

          {/* Inner container */}
          <div
            className="flex w-full max-w-[1200px] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main image panel */}
            <div
              className="flex-1 flex items-center justify-center p-8 relative"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative w-full max-h-[80vh] aspect-square">
                <Image
                  src={activeItem.url}
                  alt={activeItem.altText ?? product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 960px"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>

              {/* Arrows */}
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={activeIndex === 0}
                    aria-label={t('previous')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-secondary" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={activeIndex === media.length - 1}
                    aria-label={t('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-secondary" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail grid (right side, hidden on small screens) */}
            <div className="hidden md:block md:w-[240px] lg:w-[300px] flex-shrink-0 overflow-y-auto py-12 pr-4 pl-2">
              <div className="grid grid-cols-2 gap-2">
                {media.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    aria-label={item.type === 'video' ? `View video ${i + 1}` : `View image ${i + 1}`}
                    className={[
                      'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                      i === activeIndex
                        ? 'border-white opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-90',
                    ].join(' ')}
                  >
                    <MediaThumbnail item={item} className="" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
