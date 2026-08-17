import type { MetadataRoute } from 'next';
import { API_ROUTES } from '@ezihubb/constants';

export const revalidate = 3600; // regenerate hourly

const BASE = 'https://ezihubb.com';
// NEXT_PUBLIC_API_URL may include /api/v1 (client lib) or be the bare origin.
// Strip any trailing /api/v1 so the helper can append it consistently.
const API_ORIGIN = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002')
  .replace(/\/api\/v1\/?$/, '');

// ── Typed fetch helper ────────────────────────────────────────────────────────

interface ProductItem {
  slug:              string;
  name?:             string;
  shortDescription?: string;
  updatedAt?:        string;
  images?:           { url: string }[];
}

interface SlugItem {
  slug:       string;
  updatedAt?: string;
  level?:     number;
}

async function fetchApi<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data ?? body ?? []) as T[];
  } catch {
    return [];
  }
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // All fetches in parallel — individual failures yield empty arrays, never crash
  const [products, categories, collections, tags] = await Promise.all([
    fetchApi<ProductItem>(`${API_ROUTES.PRODUCTS.LIST}?fields=slug,updatedAt,images,name,shortDescription&limit=500&isActive=true`),
    fetchApi<SlugItem>(`${API_ROUTES.CATALOG.CATEGORIES}?isVisible=true&fields=slug,updatedAt,level`),
    fetchApi<SlugItem>(`${API_ROUTES.CATALOG.COLLECTIONS}?isActive=true&fields=slug,updatedAt`),
    fetchApi<SlugItem>(`${API_ROUTES.CATALOG.TAGS}?isFeatured=true&fields=slug`),
  ]);

  // `next-intl` routing has no `localePrefix` override, so it defaults to
  // 'always' — even the default `en` locale is served under `/en`, never at
  // the bare origin. Listing bare (unprefixed) URLs here would tell Google
  // to crawl a URL that 307/308-redirects to `/en/...`, which is exactly
  // what produced the "Page with redirect" / "Alternate page with proper
  // canonical tag" Search Console errors — every entry below must carry the
  // real, self-referencing `/en` prefix to match what `buildAlternates()`
  // now declares as canonical.
  const EN = `${BASE}/en`;

  const footerPages = [
    'our-story', 'how-it-works', 'reviews', 'careers',
    'contact', 'faq', 'shipping-info', 'returns',
    'terms', 'privacy-policy', 'payments', 'about',
  ];

  // Leaf categories only (level 3) — avoids duplicating parent-category content
  const leafCategories = categories.filter((c) => c.level === 3 || c.level === undefined);

  return [
    // ── Priority 1.0: Homepage ──────────────────────────────────────────────
    {
      url:             EN,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1.0,
    },

    // ── Priority 0.9: Main listing / hub pages ──────────────────────────────
    ...(['products', 'collections', 'occasions', 'gift-cards'] as const).map((path) => ({
      url:             `${EN}/${path}`,
      changeFrequency: 'daily' as const,
      priority:        0.9,
    })),

    // ── Priority 0.85: Product pages (with image sitemaps) ─────────────────
    ...products.map((p) => ({
      url:             `${EN}/products/${p.slug}`,
      lastModified:    p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority:        0.85,
      ...(p.images && p.images.length > 0 && {
        images: p.images.slice(0, 5).map((img) => ({
          url:     img.url,
          title:   p.name ?? p.slug,
          caption: p.shortDescription ?? p.name ?? p.slug,
        })),
      }),
    })),

    // ── Priority 0.75: Category search pages
    ...leafCategories.map((c) => ({
      url:             `${EN}/search?category=${c.slug}`,
      lastModified:    c.updatedAt ? new Date(c.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority:        0.75,
    })),

    // ── Priority 0.7: Collection pages ─────────────────────────────────────
    ...collections.map((c) => ({
      url:             `${EN}/collections/${c.slug}`,
      lastModified:    c.updatedAt ? new Date(c.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    })),

    // ── Priority 0.65: Tag landing pages ────────────────────────────────────
    // There is no standalone `/tags/[slug]` route in this app — tags are
    // surfaced as a `/search?tags=` filter (see ExploreRelatedSearches.tsx,
    // SearchResults.tsx). The old `/tags/${slug}` entries here 404'd for
    // every single one of these URLs.
    ...tags.map((t) => ({
      url:             `${EN}/search?tags=${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority:        0.65,
    })),

    // ── Priority 0.5: Static footer pages ──────────────────────────────────
    ...footerPages.map((slug) => ({
      url:             `${EN}/pages/${slug}`,
      changeFrequency: 'monthly' as const,
      priority:        0.5,
    })),

    // ── Priority 0.4: Vietnamese & Chinese locale equivalents (top 100 products) ─────
    ...(['vi', 'zh'] as const).flatMap((locale) => [
      {
        url:             `${BASE}/${locale}`,
        changeFrequency: 'daily' as const,
        priority:        0.4,
      },
      ...products.slice(0, 100).map((p) => ({
        url:             `${BASE}/${locale}/products/${p.slug}`,
        changeFrequency: 'weekly' as const,
        priority:        0.4,
      })),
    ]),
  ];
}
