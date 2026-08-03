import Link from 'next/link';
import type { ProductListItemDto } from '@ezihubb/types';
import { ProductCard } from '@ezihubb/ui';
import { BackButton } from './BackButton';
import { API_BASE } from '../../lib/api-client';

// ── Fetch trending products server-side ───────────────────────────────────────

async function getTrending(): Promise<ProductListItemDto[]> {
  try {
    const res  = await fetch(
      `${API_BASE}/api/v1/products?sort=bestseller&limit=4`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data ?? []) as ProductListItemDto[];
  } catch {
    return [];
  }
}

// ── Magnifying glass 404 illustration ────────────────────────────────────────

function Illustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="mx-auto text-muted/20"
    >
      <circle cx="52" cy="52" r="40" stroke="currentColor" strokeWidth="6" />
      <line x1="82" y1="82" x2="108" y2="108" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="38" y1="38" x2="66" y2="66" stroke="#E85D3F" strokeWidth="5" strokeLinecap="round" />
      <line x1="66" y1="38" x2="38" y2="66" stroke="#E85D3F" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NotFound() {
  const trending = await getTrending();

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="text-center mb-12">
        <p className="font-display text-8xl md:text-9xl font-bold text-primary/20 leading-none mb-4">
          404
        </p>

        <Illustration />

        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mt-6 mb-3">
          Oops! Page Not Found
        </h1>
        <p className="text-muted text-base max-w-md mx-auto mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <BackButton />
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
          >
            Go to Homepage
          </Link>
        </div>

        {/* Search */}
        <div className="max-w-sm mx-auto">
          <form action="/search" method="GET">
            <div className="flex gap-2">
              <input
                name="q"
                type="search"
                placeholder="Search for gifts…"
                className="flex-1 px-3 py-2.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary-dark transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Trending products */}
      {trending.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold text-secondary mb-6 text-center">
            Trending Right Now
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {trending.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                imageUrl={
                  product.images?.[0]?.url ??
                  'https://placehold.co/400x500.png?text=No+Image'
                }
                basePrice={product.basePrice}
                compareAtPrice={product.compareAtPrice}
                rating={product.rating?.avg}
                reviewCount={product.rating?.count}
                badge={product.badge}
                isPersonalizable={product.isPersonalizable}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
