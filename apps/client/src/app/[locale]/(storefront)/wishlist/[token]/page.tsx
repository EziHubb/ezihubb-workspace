import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HeartOff, Heart, Share2 } from 'lucide-react';
import { AddToCartFromWishlist } from './AddToCartFromWishlist';
import { API_BASE } from '../../../../../lib/api-client';
import { fmtAmount, safeArr } from '@ezihubb/utils';

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
  shareToken:   string | null;
  items:        PublicWishlistItem[];
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getPublicWishlist(token: string): Promise<PublicWishlistResponse | null> {
  try {
    const res  = await fetch(`${API_BASE}/api/v1/wishlist/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? body) as PublicWishlistResponse;
  } catch {
    return null;
  }
}

// ── Share bar ─────────────────────────────────────────────────────────────────

function ShareBar({ token, title }: { token: string; title: string }) {
  const url     = `https://ezihubb.com/wishlist/${token}`;
  const encoded = encodeURIComponent(url);
  const text    = encodeURIComponent(`Check out this wishlist on EziHubb: "${title}"`);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
        <Share2 className="w-3.5 h-3.5" /> Share this list:
      </span>
      {[
        { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, cls: 'text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20' },
        { label: 'Twitter',  href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`, cls: 'text-[#1DA1F2] bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20' },
        { label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${encoded}`, cls: 'text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20' },
      ].map(({ label, href, cls }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${cls}`}>
          {label}
        </a>
      ))}
    </div>
  );
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
    <article className="border border-border rounded-card overflow-hidden hover:shadow-card-hover transition-shadow bg-surface">
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
        <div className="absolute top-2 right-2">
          <Heart className="w-4 h-4 text-primary fill-primary/30" />
        </div>
      </Link>

      <div className="p-3 md:p-4 space-y-3">
        <Link href={`/${locale}/products/${item.productSlug}`}>
          <h3 className="text-sm font-medium text-secondary hover:text-primary transition-colors line-clamp-2 leading-snug">
            {item.productName}
          </h3>
        </Link>
        <p className="text-sm font-bold text-secondary tabular-nums">
          {fmtAmount(item.productBasePrice)}
        </p>
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

  const { wishlistName, ownerName, shareToken } = data;
  const items = safeArr(data.items);

  const heading = wishlistName
    ? wishlistName
    : ownerName
    ? `${ownerName}'s Wishlist`
    : 'Shared Wishlist';

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary fill-primary/20" />
            <h1 className="font-display text-3xl font-bold text-secondary">{heading}</h1>
          </div>
          {ownerName && wishlistName && (
            <p className="text-sm text-muted">Curated by <span className="font-medium text-secondary">{ownerName}</span></p>
          )}
          <p className="text-xs text-muted">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {shareToken && items.length > 0 && (
          <div className="shrink-0">
            <ShareBar token={shareToken} title={heading} />
          </div>
        )}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <HeartOff className="w-14 h-14 text-muted/30" aria-hidden />
          <p className="text-secondary font-semibold">This wishlist is empty</p>
          <p className="text-sm text-muted">Nothing here yet — but there's plenty to love in the store.</p>
          <Link
            href={`/${locale}/search`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            Explore Gifts
          </Link>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {items.map((item) => (
              <SharedWishlistCard key={item.id} item={item} locale={locale} />
            ))}
          </div>

          {/* ── CTA footer ──────────────────────────────────────────────────── */}
          <div className="border-t border-border pt-8 text-center">
            <p className="text-sm text-muted mb-3">Love what you see? Create your own wishlist on EziHubb.</p>
            <Link href={`/${locale}/register`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-button hover:bg-primary/90 transition-colors">
              <Heart className="w-4 h-4" />
              Start your own wishlist
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
