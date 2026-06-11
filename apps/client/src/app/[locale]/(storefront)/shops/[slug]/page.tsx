import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, Star, ShoppingBag, Share2 } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { StoreProductsClient } from './StoreProductsClient';

interface StorePublicDto {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  logoUrl:        string | null;
  bannerUrl:      string | null;
  rating:         number;
  totalOrders:    number;
  totalProducts:  number;
  verifiedAt:     string | null;
  returnPolicy:   string | null;
  shippingPolicy: string | null;
  processingDays: number | null;
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

// ── Share button ──────────────────────────────────────────────────────────────

function ShareSection({ name, slug }: { name: string; slug: string }) {
  const url     = `https://mapleloomhandmade.com/shops/${slug}`;
  const encoded = encodeURIComponent(url);
  const text    = encodeURIComponent(`Check out ${name} on MapleLoom!`);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
        <Share2 className="w-3.5 h-3.5" /> Share:
      </span>
      {[
        { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, color: 'text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20' },
        { label: 'Twitter',  href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`, color: 'text-[#1DA1F2] bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20' },
        { label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${encoded}`, color: 'text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20' },
      ].map(({ label, href, color }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${color}`}>
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
    .get<StorePublicDto>(`/stores/${slug}`)
    .catch(() => null);

  if (!store) notFound();

  const memberSince = store.verifiedAt
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(store.verifiedAt))
    : null;

  return (
    <div className="bg-background">
      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      <div className="relative h-44 md:h-60 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
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

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        {/* ── Store header ────────────────────────────────────────────────────── */}
        <div className="relative -mt-14 mb-6 flex items-end gap-5">
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
          <div className="pb-2 min-w-0 flex-1">
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
              {store.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-secondary">{store.rating.toFixed(1)}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                {store.totalOrders.toLocaleString()} sales
              </span>
              <span>{store.totalProducts} listings</span>
              {memberSince && <span>Seller since {memberSince}</span>}
            </div>
          </div>
        </div>

        {/* ── Description + Social share ─────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {store.description && (
              <p className="text-sm text-secondary/80 leading-relaxed">
                {store.description}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <ShareSection name={store.name} slug={store.slug} />
          </div>
        </div>

        {/* ── Trust signals row ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-8">
          {store.processingDays != null && (
            <div className="flex items-center gap-1.5 text-xs text-muted bg-surface border border-border rounded-full px-3 py-1.5">
              <span className="text-green-600 font-semibold">✓</span>
              Ships in {store.processingDays}–{store.processingDays + 2} business days
            </div>
          )}
          {store.verifiedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted bg-surface border border-border rounded-full px-3 py-1.5">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              Identity verified
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted bg-surface border border-border rounded-full px-3 py-1.5">
            <span className="text-primary font-semibold">✓</span>
            Secure checkout
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="border-t border-border mb-8" />

        {/* ── Products ──────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold text-secondary mb-6">
            All Products
          </h2>
          <StoreProductsClient storeSlug={store.slug} locale={locale} />
        </section>

        {/* ── Store policies ────────────────────────────────────────────────── */}
        {(store.returnPolicy || store.shippingPolicy) && (
          <section className="border-t border-border pt-8 pb-16">
            <h2 className="font-display text-lg font-bold text-secondary mb-5">Store Policies</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {store.shippingPolicy && (
                <div className="bg-surface border border-border rounded-card p-5">
                  <h3 className="font-semibold text-secondary text-sm mb-2">Shipping Policy</h3>
                  <p className="text-sm text-muted leading-relaxed">{store.shippingPolicy}</p>
                </div>
              )}
              {store.returnPolicy && (
                <div className="bg-surface border border-border rounded-card p-5">
                  <h3 className="font-semibold text-secondary text-sm mb-2">Returns & Exchanges</h3>
                  <p className="text-sm text-muted leading-relaxed">{store.returnPolicy}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {!(store.returnPolicy || store.shippingPolicy) && <div className="pb-16" />}
      </div>
    </div>
  );
}
