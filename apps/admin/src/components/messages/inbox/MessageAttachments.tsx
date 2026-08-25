'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FileText } from 'lucide-react';
import { attachmentLabel, isImageAttachment } from '@ezihubb/utils';
import { ImageLightbox } from './ImageLightbox';

/**
 * What was attached to a message.
 *
 * Images as thumbnails, everything else as a chip that says what it is. The
 * split matters as soon as PDFs are allowed: putting one in an <img> draws a
 * broken-image icon, which reads as "the file is gone" rather than "this is a
 * document".
 */

/** next/image throws during render on a src that is neither absolute nor
 *  root-relative, and a throw here would take the whole thread down. */
const renderable = (url: string): boolean =>
  url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');

export function MessageAttachments({ urls }: { urls: string[] | undefined }) {
  // Scoped to this message's own attachments — a viewer keyed to the whole
  // thread would step from one message's photos into another's.
  const [open, setOpen] = useState<number | null>(null);

  const usable = (urls ?? []).filter(renderable);
  if (!usable.length) return null;

  const images = usable.filter(isImageAttachment);
  const files  = usable.filter((u) => !isImageAttachment(u));

  return (
    <>
      <ImageLightbox urls={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />

      {images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {images.map((url, i) => (
            <li key={url}>
              {/* Opens in place. It was a link to the file on the bucket, so
                  approving a design meant leaving the inbox for a bare image
                  on another origin and finding the way back. */}
              <button type="button" onClick={() => setOpen(i)} aria-label="Open attachment">
                <Image
                  src={url}
                  alt="Attachment"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded object-cover hover:opacity-80"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-button border border-border px-3 py-2 text-sm text-secondary hover:bg-background"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="truncate">{attachmentLabel(url)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
