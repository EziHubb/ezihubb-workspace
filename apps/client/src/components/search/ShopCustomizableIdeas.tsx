'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { PaginatedResponse, ProductListItemDto } from '@ezihubb/types';

interface ShopCustomizableIdeasProps {
  query?: string;
}

export function ShopCustomizableIdeas({ query }: ShopCustomizableIdeasProps) {
  const t = useTranslations('search');
  const locale = useLocale();

  const { data: products = [] } = useQuery<ProductListItemDto[]>({
    queryKey: ['search', 'customizable', query],
    queryFn: async () => {
      // /products returns a paginated envelope, so the payload is
      // { data, pagination } and NOT an array. Typing it as an array and
      // calling .slice() straight on it would throw the moment a response
      // actually arrived — which never happened only because this request was
      // failing with a 400 first (isPersonalizable was missing from the DTO).
      // Two bugs hiding each other: fixing one alone just moves the failure.
      const result = await apiClient.get<PaginatedResponse<ProductListItemDto>>(
        API_ROUTES.PRODUCTS.LIST,
        { params: { isPersonalizable: 'true', sort: 'bestseller', limit: '6' } },
      );
      return (result?.data ?? []).slice(0, 6);
    },
    staleTime: 5 * 60_000,
  });

  if (products.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 py-8 border-t border-border">
      <h2 className="font-semibold text-secondary mb-4">{t('customizableIdeas')}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/${locale}/products/${product.slug}`}
            className="flex-shrink-0 w-32 group"
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-[#F5F1EB] mb-2">
              <img
                src={product.primaryImage ?? product.images?.[0]?.url ?? ''}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <p className="text-xs text-secondary line-clamp-2 leading-snug">{product.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
