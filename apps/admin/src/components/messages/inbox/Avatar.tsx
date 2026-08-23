'use client';

import Image from 'next/image';

/**
 * A buyer's picture, or their initial on a colour drawn from their name.
 *
 * The colour is a hash of the name rather than random, so the same person is
 * the same colour on every visit — that is what makes an avatar scannable in a
 * long list. Palette tokens only, so it survives a theme change.
 */

const TONES = [
  'bg-primary/15 text-primary',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-error/15 text-error',
  'bg-secondary/15 text-secondary',
];

const toneFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
};

/** next/image throws on a src that is neither absolute nor root-relative. */
const renderable = (url: string | null | undefined): url is string =>
  !!url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'));

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  if (renderable(src)) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-semibold ${toneFor(name)}`}
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}
