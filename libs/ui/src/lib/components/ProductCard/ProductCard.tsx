'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, type ProductBadgeVariant } from '../Badge/Badge';
import { RatingStars } from '../RatingStars/RatingStars';

export interface ProductCardLabels {
  addToWishlist?:    string;
  removeFromWishlist?: string;
  personalizeNow?:   string;
  addToCart?:        string;
  /** e.g. "By {name}" — receives the store name. */
  /**
   * Template containing {name}, e.g. "By {name}" — NOT a function.
   *
   * It used to be (name) => string, which meant any Server Component
   * building this object could not pass it to ProductCard at all: React
   * cannot serialise a function across that boundary. The homepage crashed
   * with "Functions cannot be passed directly to Client Components" the day
   * the catalogue got its first published products, because until then the
   * card branch never rendered. A plain string cannot fail that way.
   */
  byStore?:          string;
  /** Prefix shown before the price when isPriceRange is true (e.g. "From", "低至"). */
  fromPrice?:        string;
  /** Shown under the title when isDigital is true (e.g. "Digital download"). */
  digitalDownload?:  string;
}

export interface ProductCardProps {
  id:               string;
  slug:             string;
  name:             string;
  imageUrl:         string;
  basePrice:        number;
  compareAtPrice?:  number;
  /**
   * The auto-apply sale in force, if any.
   *
   * Distinct from compareAtPrice, which is the seller's own "was" price on the
   * listing and never changes. When both are present this wins: it is the
   * discount actually running, and a card quoting the other one would show
   * full price while checkout charged less.
   */
  sale?: { price: number; originalPrice: number; discountPercent: number } | null;
  /** Caller passes true when basePrice here is actually the lowest of several
   *  variant prices (not a single fixed price) — prefixes "From " so buyers
   *  don't read it as the flat price of every option. */
  isPriceRange?:    boolean;
  rating?:          number;
  reviewCount?:     number;
  badge?:           ProductBadgeVariant;
  /** Translated badge text — overrides the built-in English default (e.g. "Bestseller"). */
  badgeLabel?:      string;
  isPersonalizable?: boolean;
  isDigital?:       boolean;
  isWishlisted?:    boolean;
  currency?:        string;
  /** BCP-47 locale for price formatting (e.g. "vi", "zh"). Default: "en-US". */
  locale?:          string;
  /**
   * Prefix for every link this card renders — "/en" on the localised
   * storefront, "" where routes are not prefixed.
   *
   * Required, deliberately. It used to be absent and the hrefs were written
   * bare, so every card linked to "/products/…" and the storefront's locale
   * middleware answered each one with a 307 to "/{locale}/products/…". Users
   * never noticed (their cookie carried the locale through the redirect) but
   * Googlebot has no cookie: it saw a redirect on every product link on the
   * site and reported them as "Page with redirect" instead of indexing them.
   *
   * Passing `locale` was the obvious-looking fix and is the wrong one — that
   * prop is a BCP-47 tag for Intl.NumberFormat ("en-US"), not a route
   * segment, and would have produced "/en-US/products/…". They are separate
   * values, so this is a separate prop.
   *
   * Not optional with a "" default: a default is what let ten call sites
   * silently omit it for as long as they did. TypeScript now stops the next
   * one.
   */
  basePath:         string;
  onWishlistToggle?: (id: string) => void;
  onAddToCart?:     (id: string) => void;
  storeName?:       string | null;
  storeSlug?:       string | null;
  /** Translated labels — every field falls back to its English default. */
  labels?:          ProductCardLabels;
}

const defaultLabels: Required<ProductCardLabels> = {
  addToWishlist:      'Add to wishlist',
  removeFromWishlist: 'Remove from wishlist',
  personalizeNow:     'Personalize Now',
  addToCart:          'Add to Cart',
  byStore:            'By {name}',
  fromPrice:          'From',
  digitalDownload:    'Digital download',
};

function formatPrice(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  imageUrl,
  basePrice,
  compareAtPrice,
  sale,
  isPriceRange = false,
  rating,
  reviewCount,
  badge,
  badgeLabel,
  isPersonalizable = false,
  isDigital        = false,
  isWishlisted     = false,
  currency         = 'USD',
  locale           = 'en-US',
  basePath,
  onWishlistToggle,
  onAddToCart,
  storeName,
  storeSlug,
  labels,
}) => {
  const L = { ...defaultLabels, ...labels };
  // Built once so the two product links below cannot drift apart.
  const productHref = `${basePath}/products/${slug}`;
  const [hovered, setHovered] = useState(false);
  // A running sale takes precedence, and its own figures are used rather than
  // recomputed: the discount is defined against the listing's basePrice, so
  // the struck number and the percentage have to describe that same price or
  // they contradict each other.
  const shownPrice  = sale ? sale.price : basePrice;
  const struckPrice = sale ? sale.originalPrice : (compareAtPrice ?? null);
  const discount = sale
    ? sale.discountPercent
    : compareAtPrice && compareAtPrice > basePrice
      ? Math.round((1 - basePrice / compareAtPrice) * 100)
      : 0;

  return (
    <article
      className="group relative rounded-card border border-border bg-surface overflow-hidden hover:shadow-card-hover transition-shadow duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <Link href={productHref} className="block relative aspect-[4/5] bg-background overflow-hidden">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* The discount is a sticker on the picture, not a word in the price
            line. Inline and muted it read as a footnote to the number beside
            it; here it is the first thing the eye lands on when scanning a
            grid, which is the only moment it has to do any work.

            It takes the badge slot when a sale is running, rather than
            sitting beside a "Sale" chip that says the same thing with less
            information. The ring keeps it legible against a dark photo. */}
        {discount > 0 ? (
          <div className="absolute top-3 left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-badge-sale text-white shadow-md ring-2 ring-white">
            <span className="text-sm font-extrabold leading-none tracking-tight">-{discount}%</span>
          </div>
        ) : badge ? (
          <div className="absolute top-3 left-3">
            <Badge variant={badge}>{badgeLabel}</Badge>
          </div>
        ) : null}

        {onWishlistToggle && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onWishlistToggle(id); }}
            aria-label={isWishlisted ? L.removeFromWishlist : L.addToWishlist}
            className={[
              'absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm',
              'transition-colors duration-150',
              isWishlisted ? 'text-error' : 'text-muted hover:text-error',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}

        {/* CTA hover banner — text depends on personalizability */}
        <div
          className={[
            'absolute bottom-0 left-0 right-0 bg-primary/95 px-4 py-3',
            'transition-transform duration-300',
            hovered ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <span className="block text-center text-white text-sm font-medium">
            {isPersonalizable ? L.personalizeNow : L.addToCart}
          </span>
        </div>
      </Link>

      {/* ── Info ───────────────────────────────────────────────────────────── */}
      <div className="p-4">
        <Link href={productHref}>
          <h3 className="text-sm font-medium text-secondary line-clamp-2 mb-1 hover:text-primary transition-colors">
            {name}
          </h3>
        </Link>
        {storeName && storeSlug && (
          <Link
            href={`${basePath}/shops/${storeSlug}`}
            className="block text-xs text-muted hover:text-primary transition-colors mb-1 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {L.byStore.replace('{name}', storeName)}
          </Link>
        )}

        {isDigital && (
          <p className="text-xs text-muted mb-1">{L.digitalDownload}</p>
        )}

        {rating !== undefined && (
          <div className="mb-2">
            <RatingStars rating={rating} reviewCount={reviewCount} size="sm" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Same rule as the search card, and the same token — these two had
              drifted onto different greens, one of them the success colour,
              which says "that worked" rather than "this is on sale". */}
          {/* Largest text on the card, above the title at text-sm. A price is
              what a shopper is scanning for; it was the same size as
              everything around it. */}
          <span className={[sale ? 'text-lg font-extrabold text-badge-sale' : 'text-base font-bold text-secondary'].join(' ')}>
            {/* No "from" alongside a sale: the sale price is the listing's own,
                not the cheapest variant's, so calling it a floor would be a
                claim the number does not support. */}
            {isPriceRange && !sale && <span className="font-normal text-muted">{L.fromPrice} </span>}
            {formatPrice(shownPrice, currency, locale)}
          </span>
          {struckPrice && struckPrice > shownPrice && (sale || !isPriceRange) && (
            <>
              {/* decoration-1, not 2: at 14px a 2px rule is thick enough to sit ON
                  the digits rather than through them, which reads as the price being obscured rather than superseded. */}
              <span className="text-sm text-muted line-through decoration-1">
                {formatPrice(struckPrice, currency, locale)}
              </span>
            </>
          )}
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={() => onAddToCart(id)}
            className="mt-3 w-full h-8 rounded-button border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-white transition-colors duration-150"
          >
            {L.addToCart}
          </button>
        )}
      </div>
    </article>
  );
};
