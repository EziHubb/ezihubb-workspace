'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Star, Heart, MessageCircle, Package, HandCoins } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductDto } from '@ezihubb/types';
import type { StoreSummaryDto } from '../../app/[locale]/(storefront)/products/[slug]/page';
import { fmtRating, safeNum } from '@ezihubb/utils';
import { MessageShopModal } from '../messages/MessageShopModal';
import { MakeOfferModal } from './MakeOfferModal';

// ── Badge data ────────────────────────────────────────────────────────────────

function useSellerBadges() {
  const t = useTranslations('product.sellerCard');
  return [
    { Icon: Package,      title: t('smoothShippingTitle'), desc: t('smoothShippingDesc') },
    { Icon: MessageCircle, title: t('speedyRepliesTitle'),  desc: t('speedyRepliesDesc')  },
    { Icon: Star,          title: t('raveReviewsTitle'),    desc: t('raveReviewsDesc')    },
  ] as const;
}

// ── Helper: renders a Link when href is set, otherwise a plain div/span ───────

function ShopLink({
  href,
  className,
  children,
}: {
  href:      string | null;
  className: string;
  children:  React.ReactNode;
}) {
  if (href) {
    return <Link href={href} className={className}>{children}</Link>;
  }
  return <div className={className}>{children}</div>;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SellerCardProps {
  product:       ProductDto;
  /** From GET /stores/{slug}, fetched by the page — null while unavailable/failed. */
  storeSummary?: StoreSummaryDto | null;
}

// ── Years on platform ─────────────────────────────────────────────────────────

function yearsSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SellerCard({ product, storeSummary = null }: SellerCardProps) {
  const t = useTranslations('product.sellerCard');
  const sellerBadges = useSellerBadges();
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [offersEligible, setOffersEligible] = useState(false);
  const locale = useLocale();

  // Every product would otherwise show "Make an offer" regardless of whether
  // the seller has actually turned the feature on — check eligibility first
  // so a buyer never gets a confusing "this shop isn't accepting offers"
  // error after the fact.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ eligible: boolean }>(API_ROUTES.OFFERS.ELIGIBILITY(product.id))
      .then((res) => { if (!cancelled) setOffersEligible(res.eligible); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [product.id]);

  const storeName = product.store?.name ?? 'EziHubb';
  const storeSlug = product.store?.slug;
  const storeHref = storeSlug ? `/${locale}/shops/${storeSlug}` : null;

  const initials = storeName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="mt-12 pt-8 border-t border-border">

      {/* ── SELLER PROFILE ── */}
      <div className="flex items-start gap-4 mb-6">

        {/* Avatar — real shop logo when set, else initials. Clickable when store slug is available */}
        <ShopLink
          href={storeHref}
          className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0 hover:opacity-80 transition-opacity overflow-hidden"
        >
          {storeSummary?.logoUrl ? (
            <Image src={storeSummary.logoUrl} alt={storeName} width={56} height={56} className="w-full h-full object-cover" />
          ) : initials}
        </ShopLink>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Store name — clickable when store slug is available */}
          <ShopLink
            href={storeHref}
            className={[
              'font-semibold text-lg text-secondary',
              storeHref ? 'hover:text-primary transition-colors cursor-pointer' : '',
            ].join(' ')}
          >
            {storeName}
          </ShopLink>

          <div className="flex items-center gap-3 mt-1 text-sm text-muted flex-wrap">
            {storeSummary && storeSummary.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                {fmtRating(storeSummary.rating)}
              </span>
            )}
            {storeSummary && storeSummary.totalOrders > 0 && (
              <span>{t('sales', { count: safeNum(storeSummary.totalOrders).toLocaleString() })}</span>
            )}
            {storeSummary && (
              <span>{t('onPlatform', { years: yearsSince(storeSummary.createdAt) })}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-[#F3F4F6] transition-colors"
          >
            <Heart className="w-4 h-4" />
            {t('followShop')}
          </button>
          <button
            type="button"
            onClick={() => setIsMessageOpen(true)}
            className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-[#F3F4F6] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {t('messageSeller')}
          </button>
          {product.store?.id && offersEligible && (
            <button
              type="button"
              onClick={() => setIsOfferOpen(true)}
              className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-[#F3F4F6] transition-colors"
            >
              <HandCoins className="w-4 h-4" />
              Make an offer
            </button>
          )}
        </div>
      </div>

      {isOfferOpen && (
        <MakeOfferModal
          productId={product.id}
          productName={product.name}
          basePrice={Number(product.basePrice)}
          onClose={() => setIsOfferOpen(false)}
        />
      )}

      {/* ── SELLER BADGES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#FAFAF8] rounded-2xl">
        {sellerBadges.map(({ Icon, title, desc }) => (
          <div key={title} className="text-center">
            <div className="w-10 h-10 rounded-full bg-white border border-border mx-auto flex items-center justify-center mb-2">
              <Icon className="w-5 h-5 text-secondary" />
            </div>
            <p className="text-xs font-semibold text-secondary">{title}</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      <MessageShopModal
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        context={{ productName: product.name }}
      />
    </section>
  );
}
