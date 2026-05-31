'use client';

import { useState } from 'react';
import type { ProductDto, ReviewSummaryDto } from '@mlh/types';
import { ReviewSection } from './ReviewSection';

interface ProductTabsProps {
  product:       ProductDto;
  reviewSummary: ReviewSummaryDto | null;
  locale:        string;
}

type TabId = 'description' | 'size-guide' | 'shipping' | 'reviews';

const SHIPPING_INFO = `
**Free Standard Shipping** on orders over $50 (5–7 business days).
**Express Shipping** available at checkout (2–3 business days).
**International Shipping** available to 50+ countries.

**Returns & Exchanges:**
We accept returns within 30 days of delivery for unused, unmodified items. Personalized items are non-returnable unless defective. Contact support@maplehandmade.com to start a return.
`;

export function ProductTabs({ product, reviewSummary, locale: _locale }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');

  const reviewCount = reviewSummary?.totalReviews ?? 0;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'description', label: 'Description' },
    { id: 'size-guide',  label: 'Size Guide' },
    { id: 'shipping',    label: 'Shipping & Returns' },
    { id: 'reviews',     label: `Reviews${reviewCount > 0 ? ` (${reviewCount})` : ''}` },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Product information"
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
          aria-labelledby="tab-description"
          hidden={activeTab !== 'description'}
          className="prose prose-sm max-w-none text-secondary leading-relaxed"
        >
          {product.description ? (
            <div
              dangerouslySetInnerHTML={{ __html: product.description }}
              className="space-y-3 text-sm leading-relaxed"
            />
          ) : (
            <p className="text-muted italic">No description available.</p>
          )}
        </div>

        {/* Size Guide */}
        <div
          id="panel-size-guide"
          role="tabpanel"
          hidden={activeTab !== 'size-guide'}
          className="text-sm text-secondary space-y-4"
        >
          <p className="text-muted">
            Measurements are approximate and may vary slightly between items.
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-secondary">Size</th>
                <th className="text-left py-2 pr-4 font-semibold text-secondary">Dimensions</th>
                <th className="text-left py-2 font-semibold text-secondary">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {[
                { size: 'Small (10oz)',  dims: '3.5" × 3.5"', cap: '10 oz' },
                { size: 'Standard (15oz)', dims: '4.5" × 4"',  cap: '15 oz' },
                { size: 'Large (20oz)',  dims: '5.5" × 4"',  cap: '20 oz' },
              ].map((row) => (
                <tr key={row.size} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 text-secondary">{row.size}</td>
                  <td className="py-2.5 pr-4 text-muted">{row.dims}</td>
                  <td className="py-2.5 text-muted">{row.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shipping & Returns */}
        <div
          id="panel-shipping"
          role="tabpanel"
          hidden={activeTab !== 'shipping'}
          className="space-y-4 text-sm text-secondary"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon:  '🚚',
                title: 'Shipping',
                items: [
                  'Free standard shipping over $50',
                  'Standard: 5–7 business days',
                  'Express: 2–3 business days',
                  'International shipping available',
                ],
              },
              {
                icon:  '🔄',
                title: 'Returns',
                items: [
                  '30-day return window',
                  'Free returns for defective items',
                  'Personalized items non-returnable',
                  'Contact support to start return',
                ],
              },
              {
                icon:  '⏱️',
                title: 'Processing',
                items: [
                  'Production: 3–5 business days',
                  'Rush production available',
                  'Order updates via email',
                  'Track via order number',
                ],
              },
              {
                icon:  '🎁',
                title: 'Gift Options',
                items: [
                  'Gift wrapping available',
                  'Add a personal message',
                  'Ship directly to recipient',
                  'Gift receipts available',
                ],
              },
            ].map((card) => (
              <div key={card.title} className="bg-surface border border-border rounded-card p-4">
                <p className="font-semibold text-secondary mb-2">
                  {card.icon} {card.title}
                </p>
                <ul className="space-y-1 text-xs text-muted">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <span className="text-success mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
          />
        </div>
      </div>
    </div>
  );
}
