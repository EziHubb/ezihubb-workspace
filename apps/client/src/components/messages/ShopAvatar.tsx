'use client';

import Image from 'next/image';

/**
 * The shop's picture, or its initials.
 *
 * Three places rendered a hard-coded "ML" — text from a previous brand, on
 * every conversation of every shop. One component so the fallback is derived
 * from the actual name and there is nowhere left for a stale literal to hide.
 */

/** next/image throws during render on a src that is neither absolute nor
 *  root-relative, and a throw here takes the whole messages page down. */
const renderable = (url: string | null | undefined): url is string =>
  !!url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'));

/** First letters of the first two words — "EziHubb Store" becomes "ES". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';
}

export function ShopAvatar({ name, src, size = 40 }: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (renderable(src)) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0"
      // Sized inline rather than by class so one component covers every call
      // site; the font tracks the circle so initials do not overflow a small one.
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.35)) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}
