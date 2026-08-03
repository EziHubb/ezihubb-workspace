'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, PackageOpen, X } from 'lucide-react';
import { apiClient, useWishlist, useWishlistToggle } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ProductCard, Pagination, Skeleton } from '@ezihubb/ui';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import type { ProductListItemDto } from '@ezihubb/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaginatedProducts {
  data:       ProductListItemDto[];
  pagination: { page: number; totalPages: number; total: number };
}

interface StoreSection {
  id:    string;
  name:  string;
  count: number;
}

interface StoreSectionsResponse {
  total:    number;
  onSale:   number;
  sections: StoreSection[];
}

// ── Sort options ───────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Most Recent'        },
  { value: 'bestseller', label: 'Best Selling'        },
  { value: 'rating',     label: 'Top Rated'           },
  { value: 'price_asc',  label: 'Price: Low → High'  },
  { value: 'price_desc', label: 'Price: High → Low'  },
];

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ sort, onChange }: { sort: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Most Recent';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
      >
        Sort: {current}
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

// ── Sections sidebar ──────────────────────────────────────────────────────────

function SectionsSidebar({
  storeSlug,
  selected,
  onSaleSelected,
  onSelect,
}: {
  storeSlug:      string;
  selected:       string | null;
  onSaleSelected: boolean;
  onSelect:       (sectionId: string | null, onSale?: boolean) => void;
}) {
  const { data } = useQuery<StoreSectionsResponse>({
    queryKey:  ['store-sections', storeSlug],
    queryFn:   () => apiClient.get<StoreSectionsResponse>(API_ROUTES.STORES.SECTIONS(storeSlug)),
    staleTime: 60_000,
  });

  if (!data) return null;

  const isAllSelected = !selected && !onSaleSelected;

  return (
    <nav className="w-52 shrink-0 hidden md:block" aria-label="Shop sections">
      <ul className="space-y-0.5">
        {/* All */}
        <li>
          <button
            type="button"
            onClick={() => onSelect(null, false)}
            className={[
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
              isAllSelected
                ? 'font-semibold text-secondary bg-secondary/5'
                : 'text-secondary/70 hover:text-secondary hover:bg-secondary/5',
            ].join(' ')}
          >
            <span>All</span>
            <span className="text-muted text-xs tabular-nums">{data.total}</span>
          </button>
        </li>

        {/* On sale */}
        {data.onSale > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onSelect(null, true)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
                onSaleSelected
                  ? 'font-semibold text-secondary bg-secondary/5'
                  : 'text-secondary/70 hover:text-secondary hover:bg-secondary/5',
              ].join(' ')}
            >
              <span>On sale</span>
              <span className="text-muted text-xs tabular-nums">{data.onSale}</span>
            </button>
          </li>
        )}

        {/* Divider */}
        {data.sections.length > 0 && <li><div className="my-2 border-t border-border" /></li>}

        {/* Category sections */}
        {data.sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id, false)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
                selected === s.id
                  ? 'font-semibold text-secondary bg-secondary/5'
                  : 'text-secondary/70 hover:text-secondary hover:bg-secondary/5',
              ].join(' ')}
            >
              <span className="truncate pr-2">{s.name}</span>
              <span className="text-muted text-xs shrink-0 tabular-nums">{s.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <PackageOpen className="w-14 h-14 text-muted/30" aria-hidden />
      <div>
        <p className="font-semibold text-secondary">No products found</p>
        <p className="text-sm text-muted mt-1">Try a different filter or check back soon.</p>
      </div>
    </div>
  );
}

// ── Product grid skeleton ─────────────────────────────────────────────────────

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rect" className="aspect-[4/5] rounded-card" />
      ))}
    </div>
  );
}

// ── Product grid ──────────────────────────────────────────────────────────────

function ProductGrid({
  products,
  wishlistedIds,
  onWishlistToggle,
}: {
  products:         ProductListItemDto[];
  wishlistedIds:    Set<string>;
  onWishlistToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
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
          isWishlisted={wishlistedIds.has(product.id)}
          onWishlistToggle={onWishlistToggle}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StoreProductsClient({
  storeSlug,
  locale,
  searchQuery,
  onSearchClear,
}: {
  storeSlug:      string;
  locale:         string;
  searchQuery?:   string;
  onSearchClear?: () => void;
}) {
  const [page,            setPage]            = useState(1);
  const [sort,            setSort]            = useState('newest');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [onSaleFilter,    setOnSaleFilter]    = useState(false);

  const router      = useRouter();
  const pathname    = usePathname();
  const wishlistToggle = useWishlistToggle();
  const token          = useAuthStore((s) => s.accessToken);
  const isAuthReady    = useAuthStore((s) => s.isAuthReady);

  const { data: wishlistData } = useWishlist(isAuthReady && !!token);
  const wishlistedIds = new Set((wishlistData ?? []).map((w) => w.productId));

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [sort, selectedSection, onSaleFilter, searchQuery]);

  const hasFilter = !!selectedSection || onSaleFilter || !!searchQuery?.trim();

  // Featured items query (only shown in default state: no section/sale/search filter)
  const { data: featuredData, isLoading: featuredLoading } = useQuery<PaginatedProducts>({
    queryKey: ['store-products-featured', storeSlug],
    queryFn:  () => apiClient.get<PaginatedProducts>(API_ROUTES.PRODUCTS.LIST, {
      params: { storeSlug, isFeatured: true, isActive: true, limit: 4, sort: 'featured' },
    }),
    staleTime: 60_000,
    enabled:   !hasFilter,
  });

  // All items query
  type QP = Record<string, string | number | boolean | undefined>;
  const allParams: QP = {
    storeSlug,
    isActive:      true,
    sort,
    page,
    limit:         24,
    shopSectionId: selectedSection ?? undefined,
    onSale:        onSaleFilter ? true : undefined,
    search:        searchQuery?.trim() || undefined,
  };

  const { data: allData, isLoading: allLoading } = useQuery<PaginatedProducts>({
    queryKey: ['store-products', storeSlug, sort, page, selectedSection, onSaleFilter, searchQuery],
    queryFn:  () => apiClient.get<PaginatedProducts>(API_ROUTES.PRODUCTS.LIST, { params: allParams }),
    staleTime: 30_000,
  });

  const featured   = featuredData?.data                  ?? [];
  const products   = allData?.data                       ?? [];
  const totalPages = allData?.pagination?.totalPages     ?? 1;
  const total      = allData?.pagination?.total          ?? 0;

  const handleWishlistToggle = (productId: string) => {
    if (!token) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    wishlistToggle(productId, wishlistedIds.has(productId));
  };

  const handleSectionSelect = (section: string | null, onSale?: boolean) => {
    setSelectedSection(section);
    setOnSaleFilter(!!onSale);
    setPage(1);
  };

  const handleSortChange = (v: string) => { setSort(v); setPage(1); };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex gap-8">
      {/* ── Sections sidebar ─────────────────────────────────────────────── */}
      <SectionsSidebar
        storeSlug={storeSlug}
        selected={selectedSection}
        onSaleSelected={onSaleFilter}
        onSelect={handleSectionSelect}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-10">

        {/* ── Featured Items (only shown when no filter active) ─────────── */}
        {!hasFilter && (
          <section>
            <h2 className="font-display text-xl font-bold text-secondary mb-5">Featured items</h2>
            {featuredLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rect" className="aspect-[4/5] rounded-card" />
                ))}
              </div>
            ) : featured.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                {featured.map((product) => (
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
                    isWishlisted={wishlistedIds.has(product.id)}
                    onWishlistToggle={handleWishlistToggle}
                  />
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* ── All Items section ─────────────────────────────────────────── */}
        <section>
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <div>
              <h2 className="font-display text-xl font-bold text-secondary">
                {onSaleFilter ? 'On Sale' : selectedSection ? 'Section Items' : 'All items'}
              </h2>

              {/* Active search filter chip */}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                  "{searchQuery}"
                  <button type="button" onClick={onSearchClear} aria-label="Clear search">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!allLoading && (
                <p className="text-sm text-muted mt-0.5">
                  {total.toLocaleString()} result{total !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <SortDropdown sort={sort} onChange={handleSortChange} />
          </div>

          {/* Grid */}
          {allLoading ? (
            <GridSkeleton count={12} />
          ) : products.length === 0 ? (
            <EmptyState />
          ) : (
            <ProductGrid products={products} wishlistedIds={wishlistedIds} onWishlistToggle={handleWishlistToggle} />
          )}

          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
