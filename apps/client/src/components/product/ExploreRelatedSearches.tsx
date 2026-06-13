import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ProductDto } from '@mlh/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedChip {
  label:    string;
  href:     string;
  imageUrl: string | null;
}

interface RelatedSearches {
  featured: FeaturedChip[];
  keywords: string[];
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildRelatedSearches(product: ProductDto, locale: string): RelatedSearches {
  const tags = product.tags ?? [];

  // Derive material keyword from attributes
  const materialAttr = (product.attributes ?? []).find(
    (a) => a.key.toLowerCase() === 'material' || a.key.toLowerCase() === 'materials',
  );

  const featured: FeaturedChip[] = [
    {
      label:    'DailyDaisy',
      href:     `/${locale}/search`,
      imageUrl: null,
    },
    ...tags.slice(0, 3).map((t) => ({
      label:    t.name,
      href:     `/${locale}/search?tags=${t.slug}`,
      imageUrl: null,
    })),
  ];

  const keywords = [
    ...tags.slice(0, 6).map((t) => t.name),
    product.primaryCategory?.name,
    ...(materialAttr ? [materialAttr.value] : []),
  ].filter(Boolean) as string[];

  return { featured, keywords };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExploreRelatedSearchesProps {
  product: ProductDto;
  locale:  string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExploreRelatedSearches({ product, locale }: ExploreRelatedSearchesProps) {
  const { featured, keywords } = buildRelatedSearches(product, locale);

  if (featured.length === 0 && keywords.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold text-secondary mb-4">
        Explore related searches
      </h2>

      {/* ── FEATURED CHIPS — seller / topic with optional thumbnail ── */}
      {featured.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {featured.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-1 hover:border-secondary transition-colors"
            >
              {item.imageUrl ? (
                <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                  {item.label[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-secondary">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── KEYWORD PILLS ── */}
      {keywords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-secondary mb-3">
            Explore more related searches
          </p>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Link
                key={kw}
                href={`/${locale}/search?q=${encodeURIComponent(kw)}`}
                className="px-3 py-1.5 border border-border rounded-full text-sm text-secondary hover:border-secondary hover:text-secondary transition-colors"
              >
                {kw}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
