'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { X, Clock } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductListItemDto } from '@ezihubb/types';
import { fmtAmount } from '@ezihubb/utils';

export function RecentlyViewedPanel() {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const { data: viewed = [] } = useQuery<ProductListItemDto[]>({
    queryKey: ['recently-viewed'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<ProductListItemDto[]>(
          API_ROUTES.PRODUCTS.RECENTLY_VIEWED,
          { auth: true } as Parameters<typeof apiClient.get>[1],
        );
        return (result ?? []).slice(0, 4);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  if (viewed.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-30 hidden lg:block">
      {isOpen ? (
        <div className="bg-white border border-border rounded-2xl shadow-xl w-64 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-secondary">Recently viewed</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close recently viewed"
              className="text-muted hover:text-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
            {viewed.map((product) => (
              <Link
                key={product.id}
                href={`/${locale}/products/${product.slug}`}
                className="flex gap-2 hover:bg-[#F9FAFB] rounded-lg p-1 transition-colors"
              >
                <img
                  src={product.primaryImage ?? product.images?.[0]?.url ?? ''}
                  alt={product.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[#F5F1EB]"
                />
                <div className="min-w-0">
                  <p className="text-xs text-secondary line-clamp-2 leading-snug">{product.name}</p>
                  <p className="text-xs font-bold text-secondary mt-0.5">
                    {fmtAmount(product.basePrice)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-white border border-border rounded-full shadow-lg px-4 py-2.5 text-sm font-medium text-secondary hover:border-secondary transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4 text-muted" />
          Recently viewed
        </button>
      )}
    </div>
  );
}
