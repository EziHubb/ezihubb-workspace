import Image from 'next/image';
import Link from 'next/link';
import type { CollectionDto } from '@mlh/types';

// ── Occasion → emoji mapping ──────────────────────────────────────────────────

const OCCASION_EMOJI: Record<string, string> = {
  birthday:      '🎂',
  valentine:     '💝',
  "valentine's": '💝',
  christmas:     '🎄',
  anniversary:   '💍',
  "mother's day": '👩',
  mothers:       '👩',
  "father's day": '👨',
  fathers:       '👨',
  graduation:    '🎓',
  wedding:       '💒',
  baby:          '🍼',
  thanksgiving:  '🦃',
  easter:        '🐣',
  halloween:     '🎃',
  new_year:      '🎆',
  hanukkah:      '🕎',
};

function getEmoji(occasion?: string): string {
  if (!occasion) return '🎁';
  const key = occasion.toLowerCase().replace(/[_-]/g, ' ').trim();
  return OCCASION_EMOJI[key] ?? '🎁';
}

// ── Occasion → gradient fallback ─────────────────────────────────────────────

const OCCASION_GRADIENT: Record<string, string> = {
  birthday:      'from-[#FF6B6B] to-[#FFE66D]',
  valentine:     'from-[#FF4081] to-[#FF80AB]',
  christmas:     'from-[#2E7D52] to-[#43A047]',
  anniversary:   'from-[#7B1FA2] to-[#9C27B0]',
  mothers:       'from-[#E91E63] to-[#F48FB1]',
  fathers:       'from-[#1565C0] to-[#42A5F5]',
  graduation:    'from-[#F57F17] to-[#FFA000]',
  wedding:       'from-[#880E4F] to-[#E91E63]',
  baby:          'from-[#0288D1] to-[#29B6F6]',
  thanksgiving:  'from-[#E65100] to-[#FF8F00]',
  halloween:     'from-[#E65100] to-[#FF6F00]',
};

function getGradient(occasion?: string): string {
  if (!occasion) return 'from-primary/80 to-primary-dark/80';
  const key = occasion.toLowerCase().replace(/['\s-]/g, '').replace('sday', '');
  for (const [k, v] of Object.entries(OCCASION_GRADIENT)) {
    if (key.includes(k)) return v;
  }
  return 'from-primary/80 to-primary-dark/80';
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface OccasionCardProps {
  collection: CollectionDto & { occasion?: string; bannerUrl?: string };
  locale:     string;
}

export function OccasionCard({ collection, locale }: OccasionCardProps) {
  const occasion   = collection.occasion;
  const emoji      = getEmoji(occasion);
  const gradient   = getGradient(occasion);
  const bannerUrl  = collection.bannerUrl
    ?? (collection as { imageUrl?: string }).imageUrl;
  const count      = collection.productCount ?? 0;

  return (
    <Link
      href={`/${locale}/collections/${collection.slug}`}
      className="group relative overflow-hidden rounded-[16px] aspect-[4/3] block bg-muted"
    >
      {/* Background image or gradient fallback */}
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt={collection.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Gradient overlay — darkens on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:from-black/80 transition-colors duration-300" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        {/* Occasion emoji */}
        <span className="text-[32px] leading-none mb-2 drop-shadow-sm" aria-hidden="true">
          {emoji}
        </span>

        {/* Collection name */}
        <h3 className="font-display text-white font-bold text-lg leading-tight mb-1">
          {collection.name}
        </h3>

        {/* Product count */}
        {count > 0 && (
          <p className="text-white/80 text-xs mb-2">
            {count} personalized {count === 1 ? 'gift' : 'gifts'}
          </p>
        )}

        {/* Shop Now CTA */}
        <span className="text-white text-xs font-semibold group-hover:underline underline-offset-2 transition-all">
          Shop Now →
        </span>
      </div>
    </Link>
  );
}
