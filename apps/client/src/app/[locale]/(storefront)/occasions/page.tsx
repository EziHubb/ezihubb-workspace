import type { Metadata } from 'next';
import Link from 'next/link';
import type { CollectionDto } from '@mlh/types';
import { OccasionCard } from '../../../../components/occasions/OccasionCard';
import { fetchList } from '../../../../components/listing/types';
import { API_BASE } from '../../../../lib/api-client';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'vi' }];
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'Gift Ideas by Occasion | Daily Daisy',
    description: 'Find the perfect personalized gift for every occasion — birthdays, anniversaries, holidays, and more.',
  };
}

export default async function OccasionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch collections that have an occasion field set
  const collections = await fetchList<CollectionDto & { occasion?: string }>(
    `${API_BASE}/api/v1/catalog/collections?isActive=true`,
  );

  // Filter to only occasion-based collections (those with an occasion field)
  const occasionCollections = collections.filter(
    (c) => (c as { occasion?: string }).occasion,
  );

  return (
    <main>
      {/* ── Page Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-primary/5 py-14 md:py-20 text-center px-4">
        <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase mb-4">
          FIND THE PERFECT GIFT
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-secondary mb-4 leading-tight">
          Shop By Occasion
        </h1>
        <p className="text-muted text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          From birthdays to anniversaries — find a personalized gift
          for every special moment.
        </p>
      </section>

      {/* ── Occasions Grid ─────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 mt-12 mb-16">
        {occasionCollections.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-lg mb-4">No occasions available right now.</p>
            <Link
              href={`/${locale}/search`}
              className="text-primary hover:underline text-sm font-medium"
            >
              Browse all products →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {occasionCollections.map((collection) => (
              <OccasionCard
                key={collection.id}
                collection={collection}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-border py-16 px-4 text-center mt-4">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-3">
          Can&apos;t find your occasion?
        </h2>
        <p className="text-muted mb-8 max-w-md mx-auto">
          Browse all our personalized gifts or contact us for custom orders.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href={`/${locale}/search`}
            className="bg-primary hover:bg-primary-dark text-white font-semibold px-8 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
          >
            Browse All Gifts
          </Link>
          <Link
            href={`/${locale}/pages/contact`}
            className="border border-border text-secondary font-semibold px-8 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}
