'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  User,
  Leaf,
  Package,
  Truck,
  RotateCcw,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import type { ProductDto } from '@mlh/types';

// ── ProductDescription ────────────────────────────────────────────────────────

function ProductDescription({
  description,
  fullDescription,
}: {
  description:     string;
  fullDescription: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = description.length > 200;

  return (
    <div>
      <p className="text-sm text-secondary whitespace-pre-line leading-relaxed">
        {isExpanded ? fullDescription : description.slice(0, 200)}
        {isLong && !isExpanded && '…'}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          className="text-sm text-primary hover:underline mt-2"
        >
          {isExpanded ? 'Show less' : 'Learn more about this item'}
        </button>
      )}
    </div>
  );
}

// ── Accordion primitive ───────────────────────────────────────────────────────

export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title:        string;
  children:     ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-secondary hover:bg-[#FAFAF8] transition-colors text-left"
      >
        {title}
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}

// ── 1. Item Details ───────────────────────────────────────────────────────────

export function ItemDetailsAccordion({ product }: { product: ProductDto }) {
  // Derive materials from attributes if the seller populated a Material field
  const materialAttr = (product.attributes ?? []).find(
    (a) => a.key.toLowerCase() === 'material' || a.key.toLowerCase() === 'materials',
  );

  return (
    <Accordion title="Item details" defaultOpen>
      <div className="space-y-3">

        {/* Highlights */}
        <div>
          <p className="font-medium text-xs uppercase tracking-wide text-muted mb-2">
            Highlights
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <User className="w-4 h-4 text-secondary shrink-0" />
              <span>Made by MapleLoom</span>
            </li>
            {materialAttr && (
              <li className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600 shrink-0" />
                <span>Materials: {materialAttr.value}</span>
              </li>
            )}
          </ul>
        </div>

        {/* Description with "Learn more" expand */}
        {(product.shortDescription || product.description) && (
          <ProductDescription
            description={product.shortDescription ?? product.description.slice(0, 200)}
            fullDescription={product.description}
          />
        )}

        {/* Attribute table */}
        {(product.attributes ?? []).length > 0 && (
          <dl className="space-y-1 mt-1">
            {product.attributes!.map((attr) => (
              <div key={attr.key} className="flex gap-2 text-sm">
                <dt className="text-muted w-32 flex-shrink-0">{attr.key}</dt>
                <dd className="text-secondary">
                  {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Accordion>
  );
}

// ── 2. Shipping & Return Policies ─────────────────────────────────────────────

export function ShippingReturnsAccordion({ product }: { product: ProductDto }) {
  const processingMin = product.processingDays ?? 3;
  const processingMax = processingMin + 3;

  return (
    <Accordion title="Shipping and return policies">
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Processing time</p>
            <p className="text-xs text-muted mt-0.5">
              {processingMin}–{processingMax} business days to produce before shipping
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Truck className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <p>Free shipping</p>
        </div>

        <div className="flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Returns &amp; exchanges accepted</p>
            <p className="text-xs text-muted mt-0.5">
              Please contact us within 14 days of delivery if you have any problems.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <p>Ships from <strong>United States</strong></p>
        </div>
      </div>
    </Accordion>
  );
}

// ── 3. Purchase Protection ────────────────────────────────────────────────────

export function PurchaseProtectionAccordion() {
  return (
    <Accordion title="Did you know?">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-[#FFF0EC] flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">MapleLoom Purchase Protection</p>
          <p className="text-muted text-xs">
            Shop confidently knowing that if something goes wrong with an order,
            we&apos;ve got your back for all eligible purchases.
          </p>
          <button type="button" className="text-primary hover:underline text-xs">
            See program terms
          </button>
        </div>
      </div>
    </Accordion>
  );
}

// ── 4. FAQs ───────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How long does personalization take?',
    a: 'Personalized orders take 3–5 business days to produce before shipping.',
  },
  {
    q: 'Can I change my order after placing it?',
    a: 'Please contact us within 2 hours of ordering for any changes.',
  },
  {
    q: 'Do you accept custom orders?',
    a: 'Yes! Message us to discuss custom designs and bulk orders.',
  },
];

export function FAQsAccordion() {
  return (
    <Accordion title="FAQs">
      <div className="space-y-4">
        {FAQS.map((faq) => (
          <div key={faq.q}>
            <p className="font-medium text-sm">{faq.q}</p>
            <p className="text-muted text-xs mt-1">{faq.a}</p>
          </div>
        ))}
      </div>
    </Accordion>
  );
}

// ── 5. Meet Your Sellers ──────────────────────────────────────────────────────

export function MeetYourSellersAccordion() {
  return (
    <Accordion title="Meet your sellers">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          ML
        </div>
        <div>
          <p className="font-medium text-sm">MapleLoomHandmade</p>
          <p className="text-xs text-muted">Owner, maker and curator</p>
        </div>
      </div>
      <p className="text-sm text-muted">
        Hi! I&apos;m passionate about creating personalized, handmade gifts that tell
        your unique story. Every item is crafted with care just for you.
      </p>
      <button
        type="button"
        className="mt-3 w-full border border-border rounded-full py-2 text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
      >
        Message MapleLoomHandmade
      </button>
    </Accordion>
  );
}
