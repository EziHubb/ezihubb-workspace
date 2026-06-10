import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HeartOff } from 'lucide-react';
import { AddToCartFromWishlist } from './AddToCartFromWishlist';
import { API_BASE } from '../../../../../lib/api-client';

// Never indexed — prevent crawling of share tokens
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// ── Types matching the API's flat WishlistItemResponseDto ─────────────────────

interface PublicWishlistItem {
  id:               string;
  productId:        string;
  productName:      string;
  productSlug:      string;
  productImageUrl:  string | null;
  productBasePrice: number;
  addedAt:          string;
}

interface PublicWishlistResponse {
  wishlistName: string | null;
  ownerName:    string | null;
  items:        PublicWishlistItem[];
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getPublicWishlist(token: string): Promise<PublicWishlistResponse | null> {
  try {
    const res  = await fetch(`${API_BASE}/api/v1/wishlist/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    // Unwrap the { success, data } envelope from TransformInterceptor
    return (body?.data ?? body) as PublicWishlistResponse;
  } catch {
    return null;
  }
}

// ── Item card ─────────────────────────────────────────────────────────────────

function SharedWishlistCard({
  item,
  locale,
}: {
  item:   PublicWishlistItem;
  locale: string;
}) {
  return (
    <article className="border border-border rounded-card overflow-hidden hover:shadow-card-hover transition-shadow">
      <Link
        href={`/${locale}/products/${item.productSlug}`}
        className="block relative aspect-[4/5] overflow-hidden bg-background"
      >
        <Image
          src={item.productImageUrl ?? 'https://placehold.co/400x500.png?text=No+Image'}
          alt={item.productName}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover hover:scale-105 transition-transform duration-300"
        />
      </Link>

      <div className="p-3 md:p-4 space-y-3">
        <Link href={`/${locale}/products/${item.productSlug}`}>
          <h3 className="text-sm font-medium text-secondary hover:text-primary transition-colors line-clamp-2 leading-snug">
            {item.productName}
          </h3>
        </Link>
        <p className="text-sm font-bold text-secondary tabular-nums">
          ${item.productBasePrice.toFixed(2)}
        </p>
        {/* All items in public wishlist are already filtered to active-only on the server */}
        <AddToCartFromWishlist productId={item.productId} />
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const data = await getPublicWishlist(token);

  if (!data) notFound();

  const { wishlistName, ownerName, items } = data;

  const heading = wishlistName
    ? wishlistName
    : ownerName
    ? `${ownerName}'s Wishlist`
    : 'Shared Wishlist';

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-secondary">{heading}</h1>
        {ownerName && wishlistName && (
          <p className="text-sm text-muted">Curated by {ownerName}</p>
        )}
        <p className="text-xs text-muted">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <HeartOff className="w-14 h-14 text-muted/30" aria-hidden />
          <p className="text-secondary font-semibold">This wishlist is empty</p>
          <Link
            href={`/${locale}/products`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            Explore Gifts
          </Link>
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {items.map((item) => (
            <SharedWishlistCard key={item.id} item={item} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
