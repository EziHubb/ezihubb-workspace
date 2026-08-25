'use client';

import { useState } from 'react';
import { attachmentLabel, isImageAttachment } from '@ezihubb/utils';
import { ImageLightbox } from './ImageLightbox';

/**
 * What was attached to a message, on the buyer's side.
 *
 * Images as thumbnails, everything else as a chip that says what it is. The
 * split matters as soon as PDFs are allowed: putting one in an <img> draws a
 * broken-image icon, which reads as "the file is gone" rather than "this is a
 * document".
 */

const renderable = (url: string): boolean =>
  url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');

export function MessageAttachments({ urls, isOwn }: { urls: string[] | undefined; isOwn: boolean }) {
  // Which image the viewer has open, as an index into `images` below. Kept
  // here rather than in the bubble so each message browses only its own
  // attachments — a viewer scoped to the whole thread would step from one
  // message's photos into another's.
  const [open, setOpen] = useState<number | null>(null);

  const usable = (urls ?? []).filter(renderable);
  if (!usable.length) return null;

  const images = usable.filter(isImageAttachment);
  const files  = usable.filter((u) => !isImageAttachment(u));

  return (
    <>
      <ImageLightbox urls={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {images.map((url, i) => (
            // A button, not a link. It used to be an anchor to the file on the
            // bucket, so clicking a photo replaced the whole page with a bare
            // image on another origin and took the thread, the draft and the
            // scroll position with it.
            <button key={url} type="button" onClick={() => setOpen(i)} aria-label="Open attachment">
              {/* Plain img, not next/image: these are user uploads on a bucket
                  that would each need a remotePatterns entry, and a thumbnail
                  in a chat is not worth a config file nobody will update. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Attachment" className="h-20 w-20 rounded-lg object-cover hover:opacity-80" />
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                // Inside the buyer's own bubble the background is the primary
                // colour, so a border in the usual grey disappears into it.
                isOwn ? 'border-white/40 text-white hover:bg-white/10'
                      : 'border-border text-secondary hover:bg-background',
              ].join(' ')}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{attachmentLabel(url)}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
