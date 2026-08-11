'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProductDto, ReviewSummaryDto, ReviewDto } from '@ezihubb/types';
import { ReviewSection } from './ReviewSection';
import { ProductSpecifications } from './ProductSpecifications';
import { ShippingReturnsContent } from './ShippingReturnsContent';

// ── Product type detection (mirrors SmartVariantPicker logic) ─────────────────

type ProductType = 'apparel' | 'canvas' | 'drinkware' | 'other';

function getProductType(slug: string): ProductType {
  if (['classic-tees','hoodies','sweatshirts','onesies','kids-t-shirts',
       'v-neck-tees','long-sleeve-shirts','tank-tops','zip-hoodies','bomber-jackets'].includes(slug))
    return 'apparel';
  if (['canvas','posters-canvas','wood-acrylic-art'].includes(slug)) return 'canvas';
  if (['coffee-mugs','photo-mugs','travel-mugs','enamel-mugs','tumblers',
       'stainless-steel-tumblers','glass-tumblers','sports-bottles',
       'wine-glasses','beer-glasses'].includes(slug)) return 'drinkware';
  return 'other';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductTabsProps {
  product:         ProductDto & { sizeGuide?: string; shippingNote?: string };
  reviewSummary:   ReviewSummaryDto | null;
  initialReviews?: ReviewDto[];
  locale:          string;
}

type TabId = 'description' | 'specifications' | 'size-guide' | 'shipping' | 'reviews';

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductTabs({ product, reviewSummary, initialReviews }: ProductTabsProps) {
  const t = useTranslations('product');
  const [activeTab, setActiveTab] = useState<TabId>('description');

  const reviewCount  = reviewSummary?.totalReviews ?? 0;
  const hasAttrs     = (product.attributes?.length ?? 0) > 0;
  const productType  = getProductType(product.primaryCategory?.slug ?? '');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'description',    label: t('tabs.description') },
    ...(hasAttrs ? [{ id: 'specifications' as TabId, label: t('tabs.specifications') }] : []),
    { id: 'shipping',  label: t('tabs.shipping') },
    { id: 'reviews',   label: `${t('tabs.reviews')} (${reviewCount})` },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('productInformation')}
        className="flex border-b border-border overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-secondary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="pt-6">

        {/* Description */}
        <div
          id="panel-description"
          role="tabpanel"
          hidden={activeTab !== 'description'}
          className="prose prose-sm max-w-none text-secondary leading-relaxed"
        >
          {product.description ? (
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: product.description }}
              className="space-y-3 text-sm leading-relaxed"
            />
          ) : (
            <p className="text-muted italic">No description available.</p>
          )}
        </div>

        {/* Specifications */}
        {hasAttrs && (
          <div
            id="panel-specifications"
            role="tabpanel"
            hidden={activeTab !== 'specifications'}
            className="max-w-lg"
          >
            <h3 className="text-sm font-semibold text-secondary mb-4">
              {t('specs.title')}
            </h3>
            <ProductSpecifications attributes={product.attributes!} />
          </div>
        )}

        {/* Shipping & Returns */}
        <div
          id="panel-shipping"
          role="tabpanel"
          hidden={activeTab !== 'shipping'}
        >
          <ShippingReturnsContent
            processingDays={product.processingDays ?? 3}
            productType={productType}
          />
        </div>

        {/* Reviews */}
        <div
          id="panel-reviews"
          role="tabpanel"
          hidden={activeTab !== 'reviews'}
        >
          <ReviewSection
            productSlug={product.slug}
            reviewSummary={reviewSummary}
            initialReviews={initialReviews}
          />
        </div>
      </div>
    </div>
  );
}
