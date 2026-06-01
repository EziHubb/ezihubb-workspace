// Occasions share backend data with Collections.
// Re-export the collections page so /occasions/[slug] renders identically
// to /collections/[slug] without an extra HTTP redirect.
export { default, generateMetadata } from '../../collections/[slug]/page';

import type { CollectionDto } from '@mlh/types';
import { fetchList } from '../../../../../components/listing/types';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const base    = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
  const locales = ['en', 'vi'] as const;
  try {
    const collections = await fetchList<CollectionDto & { occasion?: string }>(
      `${base}/api/v1/catalog/collections?isActive=true`,
      3600,
    );
    // Only pre-render occasion-based collections under /occasions/
    const slugs = collections
      .filter((c) => Boolean((c as { occasion?: string }).occasion))
      .map((c) => c.slug);
    return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
  } catch {
    return [];
  }
}
