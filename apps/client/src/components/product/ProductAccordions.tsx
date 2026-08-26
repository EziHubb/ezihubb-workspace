'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  User,
  Leaf,
  Package,
  Truck,
  RotateCcw,
  MapPin,
  ShieldCheck,
  Download,
  FileText,
  Ban,
  Factory,
} from 'lucide-react';
import type { ProductDetailDto } from '@ezihubb/types';

// ── ProductDescription ────────────────────────────────────────────────────────

/**
 * Roughly how much of a description fits in the collapsed box.
 *
 * Deliberately a little UNDER what actually fits. Any character count is an
 * approximation of a height in a column whose width varies, and the two error
 * directions are not equal: guessing high hides text with no way to reach it,
 * while guessing low shows the toggle on a description that was not clipped.
 * The second is a wasted click; the first loses content.
 */
const COLLAPSED_CHARS = 200;

function ProductDescription({ description }: { description: string }) {
  const t = useTranslations('product.accordions');
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Measured against the WHOLE description.
   *
   * This used to read `description.length > 200` where `description` was
   * already `fullDescription.slice(0, 200)` — a string that cannot be longer
   * than 200 — so the condition was never true. The "Learn more about this
   * item" button therefore never rendered and everything past the 200th
   * character was unreachable on the page.
   */
  const isLong    = description.length > COLLAPSED_CHARS;
  const collapsed = isLong && !isExpanded;

  return (
    <div>
      {/*
        The full text is always in the DOM and the collapse is done in CSS.
        Slicing the string was what cut "~ Welcome" into "~ Welcom" mid-word,
        and it also meant only the first 200 characters of every product
        description were ever served to a crawler.

        Faded with a mask rather than a gradient overlay: the accordion sets
        no background of its own, so an overlay would have to guess the card
        colour and would show as a grey band the moment that guess was wrong.
        A mask fades the text itself, whatever is behind it.
      */}
      <div
        className={collapsed ? 'overflow-hidden max-h-32' : undefined}
        style={collapsed ? {
          maskImage:       'linear-gradient(to bottom, black 55%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
        } : undefined}
      >
        <p className="text-sm text-secondary whitespace-pre-line leading-relaxed">
          {description}
        </p>
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          aria-expanded={isExpanded}
          className="text-sm text-primary hover:underline mt-2"
        >
          {isExpanded ? t('showLess') : t('learnMore')}
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
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-secondary hover:bg-[#FAFAF8] transition-colors text-left"
      >
        {title}
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-3.5 text-sm text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}

// ── 1. Item Details ───────────────────────────────────────────────────────────

export function ItemDetailsAccordion({ product }: { product: ProductDetailDto }) {
  const t      = useTranslations('product.accordions');
  const tPanel = useTranslations('product.purchasePanel');
  // Derive materials from attributes if the seller populated a Material field
  const materialAttr = (product.attributes ?? []).find(
    (a) => a.key.toLowerCase() === 'material' || a.key.toLowerCase() === 'materials',
  );

  const productionPartners = product.productionPartners ?? [];
  const isDigital    = product.productType === 'DIGITAL';
  const digitalFiles = product.digitalFiles ?? [];
  const extOf = (mime: string) => mime.split('/').pop()?.split('+')[0]?.toUpperCase() ?? 'FILE';
  const fileTypeSummary = digitalFiles.length
    ? [...new Set(digitalFiles.map((f) => extOf(f.mimeType)))].join(', ')
    : null;

  return (
    <Accordion title={t('itemDetails')} defaultOpen>
      <div className="space-y-3">

        {/* Highlights — Etsy groups "Digital download" + file type here,
            alongside the maker/material bullets, not in a separate block. */}
        <div>
          <p className="font-medium text-xs uppercase tracking-wide text-muted mb-2">
            {t('highlights')}
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <User className="w-4 h-4 text-secondary shrink-0" />
              <span>{t('madeBy')}</span>
            </li>
            {/* Production partners, right after who made it — that is the
                claim this qualifies. Hidden entirely when there are none,
                since most sellers make everything themselves and "no partners"
                is not a fact a shopper needs stated. */}
            {productionPartners.length > 0 && (
              <li className="flex items-start gap-2">
                <Factory className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <span>
                  {t('madeWithPartners', {
                    names: productionPartners
                      .map((p) => (p.location ? `${p.name} (${p.location})` : p.name))
                      .join(', '),
                  })}
                </span>
              </li>
            )}
            {materialAttr && (
              <li className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600 shrink-0" />
                <span>{t('materials', { value: materialAttr.value })}</span>
              </li>
            )}
            {isDigital && (
              <li className="flex items-center gap-2">
                <Download className="w-4 h-4 text-secondary shrink-0" />
                <span>{tPanel('digitalDownload')}</span>
              </li>
            )}
            {isDigital && fileTypeSummary && (
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-secondary shrink-0" />
                <span>
                  {digitalFiles.length > 1
                    ? tPanel('digitalFileTypes', { types: fileTypeSummary, count: digitalFiles.length })
                    : tPanel('digitalFileType', { types: fileTypeSummary })}
                </span>
              </li>
            )}
          </ul>
        </div>

        {/*
          Always the full description, never shortDescription.

          Item details is where a buyer goes to read everything about the
          listing, so a seller-written summary standing in for the real text
          left the rest of it with nowhere to appear. shortDescription is not
          lost — it still backs the page metadata, the sitemap image caption
          and the quick-view modal, which is where a summary belongs.
        */}
        {product.description && (
          <ProductDescription description={product.description} />
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

export function ShippingReturnsAccordion({ product }: { product: ProductDetailDto }) {
  const t = useTranslations('product.accordions');
  const processingMin = product.processingDays ?? 3;
  const processingMax = processingMin + 3;

  return (
    <Accordion title={t('shippingAndReturns')}>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t('processingTime')}</p>
            <p className="text-xs text-muted mt-0.5">
              {t('processingDays', { min: processingMin, max: processingMax })}
            </p>
          </div>
        </div>

        {product.freeShipping && (
          <div className="flex items-start gap-2">
            <Truck className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
            <p>{t('freeShipping')}</p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t('returnsAccepted')}</p>
            <p className="text-xs text-muted mt-0.5">
              {t('returnsDetail')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <p>{t.rich('shipsFrom', { strong: (chunks) => <strong>{chunks}</strong> })}</p>
        </div>
      </div>
    </Accordion>
  );
}

// ── 2b. Delivery (digital — replaces Shipping & Returns in the same slot) ─────

export function DigitalDeliveryAccordion() {
  const t      = useTranslations('product.accordions');
  const tPanel = useTranslations('product.purchasePanel');

  return (
    <Accordion title={t('delivery')}>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Download className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t('instantDownloadTitle')}</p>
            <p className="text-xs text-muted mt-0.5">{t('instantDownloadBody')}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Ban className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <p className="text-xs text-muted">{tPanel('nonRefundable')}</p>
        </div>
      </div>
    </Accordion>
  );
}

// ── 3. Purchase Protection ────────────────────────────────────────────────────

export function PurchaseProtectionAccordion() {
  const t = useTranslations('product.accordions');
  return (
    <Accordion title={t('didYouKnow')}>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-[#FFF0EC] flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{t('purchaseProtection')}</p>
          <p className="text-muted text-xs">
            {t('purchaseProtectionDetail')}
          </p>
          <button type="button" className="text-primary hover:underline text-xs">
            {t('seeProgramTerms')}
          </button>
        </div>
      </div>
    </Accordion>
  );
}

// ── 4. FAQs ───────────────────────────────────────────────────────────────────

export function FAQsAccordion() {
  const t = useTranslations('product.accordions');
  const faqs = [
    { q: t('faq1q'), a: t('faq1a') },
    { q: t('faq2q'), a: t('faq2a') },
    { q: t('faq3q'), a: t('faq3a') },
  ];
  return (
    <Accordion title={t('faqs')}>
      <div className="space-y-4">
        {faqs.map((faq) => (
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
  const t = useTranslations('product.accordions');
  return (
    <Accordion title={t('meetYourSellers')}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          ML
        </div>
        <div>
          <p className="font-medium text-sm">EziHubb</p>
          <p className="text-xs text-muted">{t('ownerMakerCurator')}</p>
        </div>
      </div>
      <p className="text-sm text-muted">
        {t('sellerBio')}
      </p>
      <button
        type="button"
        className="mt-3 w-full border border-border rounded-full py-2 text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
      >
        {t('messageSeller')}
      </button>
    </Accordion>
  );
}
