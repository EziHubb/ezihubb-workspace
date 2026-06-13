'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, PackageOpen } from 'lucide-react';
import { apiClient, useMutateWishlist } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { ProductCard, Pagination, Skeleton } from '@mlh/ui';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import type { ProductListItemDto } from '@mlh/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'featured' | 'all';

interface PaginatedProducts {
  data:       ProductListItemDto[];
  pagination: { page: number; totalPages: number; total: number };
}

// ── Sort options — values MUST match ProductSortBy enum (lowercase) ────────────

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest'             },
  { value: 'bestseller', label: 'Best Selling'        },
  { value: 'rating',     label: 'Top Rated'           },
  { value: 'price_asc',  label: 'Price: Low → High'  },
  { value: 'price_desc', label: 'Price: High → Low'  },
];

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({
  sort,
  onChange,
}: {
  sort:     string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort by';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-secondary border border-border rounded-button px-4 py-2 hover:border-primary/60 transition-colors bg-surface"
      >
        <span>{current}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-card shadow-lg py-1 min-w-[190px]">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-primary/5',
                  sort === opt.value ? 'text-primary font-semibold' : 'text-secondary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ mode, onSeeAll }: { mode: Mode; onSeeAll?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <PackageOpen className="w-14 h-14 text-muted/30" aria-hidden />
      <div>
        <p className="font-semibold text-secondary">
          {mode === 'featured' ? 'No featured items yet' : 'No products yet'}
        </p>
        <p className="text-sm text-muted mt-1">This shop hasn't added any listings yet. Check back soon!</p>
      </div>
      {mode === 'featured' && onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-1 text-sm font-medium text-primary border border-primary/30 px-5 py-2.5 rounded-button hover:bg-primary/5 transition-colors"
        >
          Browse all items
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StoreProductsClient({
  storeSlug,
  locale,
  mode,
  onSeeAll,
}: {
  storeSlug: string;
  locale:    string;
  mode:      Mode;
  onSeeAll?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');

  const router   = useRouter();
  const pathname = usePathname();
  const { addToWishlist } = useMutateWishlist();
  const token = useAuthStore((s) => s.accessToken);

  const queryParams =
    mode === 'featured'
      ? { storeSlug, isFeatured: true, isActive: true, limit: 8, sort: 'featured' }
      : { storeSlug, isActive: true, sort, page, limit: 24 };

  const { data, isLoading } = useQuery<PaginatedProducts>({
    queryKey: ['store-products', storeSlug, mode, sort, page],
    queryFn:  () => apiClient.get<PaginatedProducts>(API_ROUTES.PRODUCTS.LIST, { params: queryParams }),
    staleTime: 30_000,
  });

  const products   = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total      = data?.pagination?.total      ?? 0;

  const handleWishlistToggle = (productId: string) => {
    if (!token) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    addToWishlist.mutate(productId);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (v: string) => {
    setSort(v);
    setPage(1);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    const count = mode === 'featured' ? 8 : 12;
    return (
      <div className={`grid gap-4 md:gap-6 ${
        mode === 'featured'
          ? 'grid-cols-2 md:grid-cols-4'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="aspect-[4/5] rounded-card" />
        ))}
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (products.length === 0) {
    return <EmptyState mode={mode} onSeeAll={onSeeAll} />;
  }

  // ── Featured mode: simple 4-col grid ─────────────────────────────────────

  if (mode === 'featured') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            slug={product.slug}
            name={product.name}
            imageUrl={product.primaryImage ?? 'https://placehold.co/400x500.png?text=No+Image'}
            basePrice={product.basePrice}
            compareAtPrice={product.compareAtPrice}
            rating={product.rating?.avg}
            reviewCount={product.rating?.count}
            badge={product.badge}
            isPersonalizable={product.isPersonalizable}
            onWishlistToggle={handleWishlistToggle}
          />
        ))}
      </div>
    );
  }

  // ── All mode: sort bar + grid + pagination ────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Sort + count row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted">
          {total.toLocaleString()} result{total !== 1 ? 's' : ''}
        </p>
        <SortDropdown sort={sort} onChange={handleSortChange} />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            slug={product.slug}
            name={product.name}
            imageUrl={product.primaryImage ?? 'https://placehold.co/400x500.png?text=No+Image'}
            basePrice={product.basePrice}
            compareAtPrice={product.compareAtPrice}
            rating={product.rating?.avg}
            reviewCount={product.rating?.count}
            badge={product.badge}
            isPersonalizable={product.isPersonalizable}
            onWishlistToggle={handleWishlistToggle}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
