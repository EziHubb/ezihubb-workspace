import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ShieldCheck, Star, ShoppingBag, Share2 } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { StorePageClient } from './StorePageClient';

interface StorePublicDto {
  id:            string;
  name:          string;
  slug:          string;
  description:   string | null;
  logoUrl:       string | null;
  bannerUrl:     string | null;
  status:        string;
  rating:        number;
  totalOrders:   number;
  totalProducts: number;
  verifiedAt:    string | null;
  createdAt:     string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const store = await apiClient
    .get<StorePublicDto>(API_ROUTES.STORES.DETAIL(slug))
    .catch(() => null);

  if (!store) return { title: 'Store not found' };

  return {
    title:       `${store.name} | Daily Daisy`,
    description: store.description?.slice(0, 160) ?? `Shop ${store.name} on Daily Daisy.`,
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

// ── Share buttons ─────────────────────────────────────────────────────────────

function ShareButtons({ name, slug }: { name: string; slug: string }) {
  const url     = `https://dailydaisy.com/shops/${slug}`;
  const encoded = encodeURIComponent(url);
  const text    = encodeURIComponent(`Check out ${name} on Daily Daisy!`);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-muted font-medium">
        <Share2 className="w-3.5 h-3.5" /> Share:
      </span>
      {[
        { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, color: 'text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20' },
        { label: 'Twitter',  href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`, color: 'text-[#1DA1F2] bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20' },
        { label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${encoded}`, color: 'text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20' },
      ].map(({ label, href, color }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${color}`}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StorePublicPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  const store = await apiClient
    .get<StorePublicDto>(API_ROUTES.STORES.DETAIL(slug))
    .catch(() => null);

  if (!store) notFound();

  const memberSince = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year:  'numeric',
  }).format(new Date(store.verifiedAt ?? store.createdAt));

  const rating = Number(store.rating) ?? 0;

  return (
    <div className="bg-background pb-16">
      {/* ── Banner ────────────────────────────────────────────────────────────── */}
      <div className="relative h-44 md:h-64 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {/* ── Store header ──────────────────────────────────────────────────────── */}
        <div className="relative -mt-12 md:-mt-16 mb-5 flex items-end gap-4 md:gap-5">
          {/* Logo */}
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-surface bg-surface overflow-hidden shadow-lg shrink-0">
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={112}
                height={112}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {store.name[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Name + stats */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary">
                {store.name}
              </h1>
              {store.verifiedAt && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Verified Seller
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted">
              {rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-secondary">{rating.toFixed(1)}</span>
                  <span>rating</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                {store.totalOrders.toLocaleString()} sales
              </span>
              <span>{store.totalProducts.toLocaleString()} listings</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>

          {/* Share — desktop only */}
          <div className="hidden md:block pb-1 shrink-0">
            <ShareButtons name={store.name} slug={store.slug} />
          </div>
        </div>

        {/* Description + mobile share */}
        <div className="flex flex-col md:flex-row md:items-start gap-3 mb-0">
          {store.description && (
            <p className="flex-1 min-w-0 text-sm text-secondary/80 leading-relaxed line-clamp-3 md:line-clamp-none">
              {store.description}
            </p>
          )}
          <div className="md:hidden">
            <ShareButtons name={store.name} slug={store.slug} />
          </div>
        </div>
      </div>

      {/* ── Tab navigation + tab content (client) ────────────────────────────── */}
      <StorePageClient
        store={{
          id:            store.id,
          name:          store.name,
          slug:          store.slug,
          description:   store.description,
          rating,
          totalProducts: store.totalProducts,
          totalOrders:   store.totalOrders,
        }}
        locale={locale}
      />
    </div>
  );
}
