import type { MetadataRoute } from 'next';

export const revalidate = 3600; // regenerate hourly

const BASE = 'https://maplehandmade.com';
const API  = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

// ── Fetchers ──────────────────────────────────────────────────────────────────

interface SlugItem {
  slug:       string;
  updatedAt?: string;
}

async function fetchSlugs(path: string): Promise<SlugItem[]> {
  try {
    const res = await fetch(`${API}/api/v1${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data ?? body ?? []) as SlugItem[];
  } catch {
    return [];
  }
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections] = await Promise.all([
    fetchSlugs('/products?fields=slug,updatedAt&limit=1000&isActive=true'),
    fetchSlugs('/catalog/categories?fields=slug'),
    fetchSlugs('/catalog/collections?fields=slug&isActive=true'),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url:             `${BASE}/products/${p.slug}`,
    lastModified:    p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority:        0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url:             `${BASE}/categories/${c.slug}`,
    changeFrequency: 'weekly',
    priority:        0.7,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url:             `${BASE}/collections/${c.slug}`,
    changeFrequency: 'weekly',
    priority:        0.7,
  }));

  return [
    // ── Core pages ────────────────────────────────────────────────────────────
    {
      url:             BASE,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1.0,
    },
    {
      url:             `${BASE}/products`,
      changeFrequency: 'daily',
      priority:        0.9,
    },
    {
      url:             `${BASE}/gift-cards`,
      changeFrequency: 'monthly',
      priority:        0.6,
    },

    // ── Static info pages ─────────────────────────────────────────────────────
    { url: `${BASE}/pages/about`,   changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/pages/faq`,     changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/pages/contact`, changeFrequency: 'monthly', priority: 0.5 },

    // ── Dynamic pages ─────────────────────────────────────────────────────────
    ...productEntries,
    ...categoryEntries,
    ...collectionEntries,
  ];
}
