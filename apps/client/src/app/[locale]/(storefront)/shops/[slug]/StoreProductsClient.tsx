'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, PackageOpen, X } from 'lucide-react';
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

interface StoreSection {
  id:    string;
  name:  string;
  slug:  string;
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
  onSelect,
}: {
  storeSlug: string;
  selected:  string | null;
  onSelect:  (section: string | null, onSale?: boolean) => void;
}) {
  const [onSaleSelected, setOnSaleSelected] = useState(false);

  const { data } = useQuery<StoreSectionsResponse>({
    queryKey: ['store-sections', storeSlug],
    queryFn:  () => apiClient.get<StoreSectionsResponse>(API_ROUTES.STORES.SECTIONS(storeSlug)),
    staleTime: 60_000,
  });

  if (!data) return null;

  const handleAll = () => {
    setOnSaleSelected(false);
    onSelect(null, false);
  };

  const handleOnSale = () => {
    setOnSaleSelected(true);
    onSelect(null, true);
  };

  const handleSection = (section: StoreSection) => {
    setOnSaleSelected(false);
    onSelect(section.id, false);
  };

  const isAllSelected = !selected && !onSaleSelected;

  return (
    <nav className="w-56 shrink-0 hidden md:block">
      <ul className="space-y-0.5">
        {/* All */}
        <li>
          <button
            type="button"
            onClick={handleAll}
            className={[
              'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors text-left',
              isAllSelected ? 'font-semibold text-secondary' : 'text-secondary/70 hover:text-secondary',
            ].join(' ')}
          >
            <span>All</span>
            <span className="text-muted text-xs">{data.total}</span>
          </button>
        </li>

        {/* On sale */}
        {data.onSale > 0 && (
          <li>
            <button
              type="button"
              onClick={handleOnSale}
              className={[
                'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors text-left',
                onSaleSelected ? 'font-semibold text-secondary' : 'text-secondary/70 hover:text-secondary',
              ].join(' ')}
            >
              <span>On sale</span>
              <span className="text-muted text-xs">{data.onSale}</span>
            </button>
          </li>
        )}

        {/* Category sections */}
        {data.sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => handleSection(s)}
              className={[
                'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors text-left',
                selected === s.id ? 'font-semibold text-secondary' : 'text-secondary/70 hover:text-secondary',
              ].join(' ')}
            >
              <span className="truncate pr-2">{s.name}</span>
              <span className="text-muted text-xs shrink-0">{s.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
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
  searchQuery,
  onSearchClear,
}: {
  storeSlug:      string;
  locale:         string;
  mode:           Mode;
  onSeeAll?:      () => void;
  searchQuery?:   string;
  onSearchClear?: () => void;
}) {
  const [page,            setPage]            = useState(1);
  const [sort,            setSort]            = useState('newest');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [onSaleFilter,    setOnSaleFilter]    = useState(false);

  const router   = useRouter();
  const pathname = usePathname();
  const { addToWishlist } = useMutateWishlist();
  const token = useAuthStore((s) => s.accessToken);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [sort, selectedSection, onSaleFilter, searchQuery]);

  type QP = Record<string, string | number | boolean | undefined>;
  const queryParams: QP =
    mode === 'featured'
      ? { storeSlug, isFeatured: true, isActive: true, limit: 8, sort: 'featured' }
      : {
          storeSlug,
          isActive:   true,
          sort,
          page,
          limit:      24,
          categoryId: selectedSection ?? undefined,
          onSale:     onSaleFilter   ? true : undefined,
          search:     searchQuery?.trim() || undefined,
        };

  const { data, isLoading } = useQuery<PaginatedProducts>({
    queryKey: ['store-products', storeSlug, mode, sort, page, selectedSection, onSaleFilter, searchQuery],
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

  // ── Featured mode ─────────────────────────────────────────────────────────

  if (mode === 'featured') {
    if (products.length === 0) return <EmptyState mode={mode} onSeeAll={onSeeAll} />;
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

  // ── All mode: sections sidebar + sort + grid + pagination ─────────────────

  return (
    <div className="flex gap-8">
      {/* ── Sections sidebar ─────────────────────────────────────────────── */}
      <SectionsSidebar
        storeSlug={storeSlug}
        selected={selectedSection}
        onSelect={handleSectionSelect}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* ── Featured Items heading + sort ──────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-secondary">
              {onSaleFilter ? 'On Sale' : selectedSection ? null : 'All Items'}
            </h2>
            {/* Active filters */}
            {(searchQuery || onSaleFilter) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                    "{searchQuery}"
                    <button type="button" onClick={onSearchClear}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-muted mt-0.5">
              {total.toLocaleString()} result{total !== 1 ? 's' : ''}
            </p>
          </div>
          <SortDropdown sort={sort} onChange={handleSortChange} />
        </div>

        {/* ── Product grid ───────────────────────────────────────────────── */}
        {products.length === 0 ? (
          <EmptyState mode={mode} onSeeAll={onSeeAll} />
        ) : (
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
                onWishlistToggle={handleWishlistToggle}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
