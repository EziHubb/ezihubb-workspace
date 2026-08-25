'use client';

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * An attached image, full size, without leaving the conversation.
 *
 * Clicking a thumbnail used to be a plain link to the file on the bucket: the
 * whole page was replaced by a bare image on another origin, and the only way
 * back was the browser's back button. In a chat that is a hard exit — the
 * thread, the draft in the composer and the scroll position all go with it.
 */

export function ImageLightbox({
  urls,
  index,
  onClose,
  onIndex,
}: {
  urls:  string[];
  /** Which image is open. Null closes the viewer. */
  index: number | null;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const open = index !== null && index >= 0 && index < urls.length;

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      // Wraps, so the arrows never dead-end on a set of two.
      onIndex((index + delta + urls.length) % urls.length);
    },
    [index, urls.length, onIndex],
  );

  /**
   * Escape closes and the arrows move, because a viewer that only answers the
   * mouse is a viewer half the people looking at it cannot drive.
   *
   * Bound to the document rather than a focused element: the overlay is
   * rendered through a portal and may not hold focus when it opens.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft')  step(-1);
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll while the overlay is up, or a scroll
    // gesture aimed at the image quietly moves the thread underneath it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, step]);

  // A portal, so the overlay is not clipped by the thread pane's
  // overflow-hidden and does not inherit its stacking context.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attachment"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      // Only a click on the backdrop itself closes. Without the target check a
      // click that started on the image and drifted would close it too.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Plain img: these are user uploads on a bucket that would each need a
          next.config remotePatterns entry, and the viewer shows them at their
          own size rather than a layout-fixed one. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt="Attachment"
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
      />

      {urls.length > 1 && (
        <p className="absolute bottom-6 text-sm text-white/70">
          {index + 1} / {urls.length}
        </p>
      )}
    </div>,
    document.body,
  );
}
