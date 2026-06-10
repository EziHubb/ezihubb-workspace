import type { MetadataRoute } from 'next';
import { API_ROUTES } from '@mlh/constants';

export const revalidate = 3600; // regenerate hourly

const BASE = 'https://mapleloomhandmade.com';
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

  const footerPages = [
    'our-story', 'how-it-works', 'reviews', 'careers',
    'contact', 'faq', 'shipping-info', 'returns',
  ];

  // Leaf categories only (level 3) — avoids duplicating parent-category content
  const leafCategories = categories.filter((c) => c.level === 3 || c.level === undefined);

  return [
    // ── Priority 1.0: Homepage ──────────────────────────────────────────────
    {
      url:             BASE,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1.0,
    },

    // ── Priority 0.9: Main listing / hub pages ──────────────────────────────
    ...(['products', 'collections', 'occasions', 'gift-cards'] as const).map((path) => ({
      url:             `${BASE}/${path}`,
      changeFrequency: 'daily' as const,
      priority:        0.9,
    })),

    // ── Priority 0.85: Product pages (with image sitemaps) ─────────────────
    ...products.map((p) => ({
      url:             `${BASE}/products/${p.slug}`,
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

    // ── Priority 0.75: Category pages (leaf only — avoids thin-content dups)
    ...leafCategories.map((c) => ({
      url:             `${BASE}/categories/${c.slug}`,
      lastModified:    c.updatedAt ? new Date(c.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority:        0.75,
    })),

    // ── Priority 0.7: Collection pages ─────────────────────────────────────
    ...collections.map((c) => ({
      url:             `${BASE}/collections/${c.slug}`,
      lastModified:    c.updatedAt ? new Date(c.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    })),

    // ── Priority 0.65: Tag landing pages ───────────────────────────────────
    ...tags.map((t) => ({
      url:             `${BASE}/tags/${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority:        0.65,
    })),

    // ── Priority 0.5: Static footer pages ──────────────────────────────────
    ...footerPages.map((slug) => ({
      url:             `${BASE}/pages/${slug}`,
      changeFrequency: 'monthly' as const,
      priority:        0.5,
    })),

    // ── Priority 0.4: Vietnamese locale equivalents (top 100 products) ─────
    {
      url:             `${BASE}/vi`,
      changeFrequency: 'daily' as const,
      priority:        0.4,
    },
    ...products.slice(0, 100).map((p) => ({
      url:             `${BASE}/vi/products/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority:        0.4,
    })),
  ];
}
