'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../lib/api-client';
import { fmtAmount, fmtDate } from '../../lib/fmt';
import type {
  AdminProductDto,
  AdminProductDetailDto,
  ProductVariantRow,
} from './edit/types';

export function ProductReadOnlyNotice() {
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-secondary">
      <Eye aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">Platform mode · View only</p>
        <p className="mt-1 text-muted">
          You can review all listings here. Switch to My Store to create or
          manage listings in your own shop.
        </p>
      </div>
    </div>
  );
}

export function ProductReadOnlyView({
  product,
  detail,
}: {
  product: AdminProductDto;
  detail?: AdminProductDetailDto | null;
}) {
  const variants = useQuery({
    queryKey: ['admin-product-readonly-variants', product.id],
    queryFn: () =>
      api.get<ProductVariantRow[]>(
        API_ROUTES.ADMIN.PRODUCT_VARIATION_VARIANTS(product.id),
      ),
  });
  const fields = [
    ['Status', product.status ?? (product.isActive ? 'ACTIVE' : 'INACTIVE')],
    ['SKU', product.sku],
    ['Store ID', product.storeId ?? 'Not assigned'],
    ['Base price', fmtAmount(Number(product.basePrice))],
    [
      'Stock',
      product.quantity == null ? 'Unlimited' : String(product.quantity),
    ],
    ['Created', fmtDate(product.createdAt)],
    ['Sales', String(product.soldCount)],
    ['Product type', product.productType ?? 'PHYSICAL'],
  ];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link href="/products" className="text-sm text-primary hover:underline">
        ← Back to listings
      </Link>
      <ProductReadOnlyNotice />
      <h1 className="break-words text-2xl font-semibold text-secondary">
        {product.name || 'Untitled listing'}
      </h1>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/stats/listings/${product.id}`}
          className="text-primary hover:underline"
        >
          View performance
        </Link>
        {product.isActive && (
          <a
            href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/products/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            View on site ↗
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {product.images.map((image) => (
          <a
            key={image.id}
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative aspect-square overflow-hidden rounded-xl border border-border"
          >
            <Image
              src={image.url}
              alt={product.name || 'Product image'}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-contain"
            />
          </a>
        ))}
      </div>
      {!!product.videoUrls?.length && (
        <section className="flex flex-wrap gap-4 text-sm">
          {product.videoUrls.map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View video {index + 1} (opens in a new tab)
            </a>
          ))}
        </section>
      )}
      <dl className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 break-words font-medium text-secondary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">Description</h2>
        <p className="whitespace-pre-wrap break-words text-sm text-secondary">
          {product.description || 'No description'}
        </p>
      </section>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">Variations</h2>
        {variants.isPending ? (
          <p role="status">Loading variations…</p>
        ) : variants.isError ? (
          <p role="alert">
            Could not load variations.{' '}
            <button
              type="button"
              onClick={() => variants.refetch()}
              className="text-primary underline"
            >
              Retry
            </button>
          </p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Combination</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Visible</th>
                </tr>
              </thead>
              <tbody>
                {variants.data.map((variant) => (
                  <tr key={variant.id} className="border-t border-border">
                    <td className="p-2">
                      {Object.entries(variant.options)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' / ') || variant.name}
                    </td>
                    <td className="p-2">
                      {fmtAmount(variant.price ?? Number(product.basePrice))}
                    </td>
                    <td className="p-2">{variant.quantity ?? 'Unlimited'}</td>
                    <td className="p-2">
                      {variant.isAvailable ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {variants.data.length === 0 && (
              <p className="text-muted">No variations</p>
            )}
          </div>
        )}
      </section>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">Custom options</h2>
        {(detail?.customOptions ?? product.customOptions ?? []).map(
          (option) => (
            <div
              key={option.id}
              className="border-b border-border py-3 last:border-0"
            >
              <p className="font-medium">
                {option.label} · {option.required ? 'Required' : 'Optional'}
              </p>
              <p className="text-sm text-muted">
                {option.type} · {option.instructionText}
              </p>
              {option.choices?.length > 0 && (
                <p className="text-sm">{option.choices.join(', ')}</p>
              )}
            </div>
          ),
        )}
        {(detail?.customOptions ?? product.customOptions ?? []).length ===
          0 && <p className="text-sm text-muted">No custom options</p>}
      </section>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">SEO</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted">Meta title</dt>
            <dd className="break-words">{detail?.metaTitle || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-muted">Meta description</dt>
            <dd className="break-words">
              {detail?.metaDescription || 'Not set'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
