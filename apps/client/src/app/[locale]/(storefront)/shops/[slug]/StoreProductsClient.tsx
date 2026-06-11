'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { ProductCard, Pagination, Skeleton } from '@mlh/ui';
import { useMutateWishlist } from '@mlh/api-client';
import { useRouter, usePathname } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import type { ProductListItemDto } from '@mlh/types';

interface PaginatedProducts {
  data:       ProductListItemDto[];
  pagination: { page: number; totalPages: number; total: number };
}

export function StoreProductsClient({
  storeSlug,
  locale,
}: {
  storeSlug: string;
  locale:    string;
}) {
  const [page, setPage] = useState(1);
  const router   = useRouter();
  const pathname = usePathname();
  const { addToWishlist } = useMutateWishlist();

  const { data, isLoading } = useQuery<PaginatedProducts>({
    queryKey: ['store-products', storeSlug, page],
    queryFn:  () =>
      apiClient.get<PaginatedProducts>('/products', {
        params: { storeSlug, page, limit: 24, isActive: true },
      }),
    staleTime: 30_000,
  });

  const products   = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total      = data?.pagination?.total      ?? 0;

  const handleWishlistToggle = (productId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    addToWishlist.mutate(productId);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="aspect-[4/5] rounded-card" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <PackageOpen className="w-14 h-14 text-muted/30" />
        <p className="font-semibold text-secondary">No products yet</p>
        <p className="text-sm text-muted">This store hasn't listed any products yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{total} product{total !== 1 ? 's' : ''}</p>
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
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}
    </div>
  );
}
