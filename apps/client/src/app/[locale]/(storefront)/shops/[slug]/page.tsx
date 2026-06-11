import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { apiClient } from '@mlh/api-client';
import { StoreProductsClient } from './StoreProductsClient';

interface StorePublicDto {
  id:           string;
  name:         string;
  slug:         string;
  description:  string | null;
  logoUrl:      string | null;
  bannerUrl:    string | null;
  rating:       number;
  totalOrders:  number;
  totalProducts:number;
  verifiedAt:   string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const store = await apiClient
    .get<StorePublicDto>(`/stores/${slug}`)
    .catch(() => null);

  if (!store) return { title: 'Store not found' };

  return {
    title:       `${store.name} | MapleLoom`,
    description: store.description?.slice(0, 160) ?? `Shop ${store.name} on MapleLoom.`,
    openGraph: {
      title:       store.name,
      description: store.description?.slice(0, 160),
      images:      store.bannerUrl ? [store.bannerUrl] : [],
      url:         `/shops/${slug}`,
    },
    alternates: { canonical: `/${locale}/shops/${slug}` },
  };
}

export const dynamic = 'force-dynamic';

export default async function StorePublicPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  const store = await apiClient
    .get<StorePublicDto>(`/stores/${slug}`)
    .catch(() => null);

  if (!store) notFound();

  const memberSince = store.verifiedAt
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(store.verifiedAt))
    : null;

  return (
    <div>
      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      <div className="relative h-40 md:h-56 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
        {store.bannerUrl && (
          <Image
            src={store.bannerUrl}
            alt={`${store.name} banner`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
      </div>

      {/* ── Store header ────────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        <div className="relative -mt-12 mb-8 flex items-end gap-5">
          {/* Logo */}
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-surface bg-surface overflow-hidden shadow-md shrink-0">
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={112}
                height={112}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
                {store.name[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + stats */}
          <div className="pb-2 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary truncate">
              {store.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted">
              {store.rating > 0 && (
                <span>★ {store.rating.toFixed(1)} rating</span>
              )}
              <span>{store.totalOrders} sales</span>
              {memberSince && <span>Member since {memberSince}</span>}
            </div>
          </div>
        </div>

        {/* Description */}
        {store.description && (
          <p className="text-sm text-secondary/80 mb-8 max-w-2xl leading-relaxed">
            {store.description}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-border mb-8" />

        {/* Products */}
        <section>
          <h2 className="font-display text-xl font-bold text-secondary mb-6">
            Products
          </h2>
          <StoreProductsClient storeSlug={store.slug} locale={locale} />
        </section>

        <div className="pb-16" />
      </div>
    </div>
  );
}
