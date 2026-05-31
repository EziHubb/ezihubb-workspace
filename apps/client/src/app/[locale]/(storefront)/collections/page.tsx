import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { CollectionDto } from '@mlh/types';
import { fetchList } from '../../../../components/listing/types';

export const revalidate = 60;

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'vi' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:       locale === 'vi'
      ? 'Bộ Sưu Tập | Maple Handmade'
      : 'Collections | Maple Handmade',
    description: 'Explore our curated gift collections — seasonal, occasion-based, and themed.',
  };
}

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const base       = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const collections = await fetchList<CollectionDto & { bannerUrl?: string; imageUrl?: string }>(
    `${base}/api/v1/catalog/collections?isActive=true`,
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Page header */}
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary">
          {locale === 'vi' ? 'Bộ Sưu Tập' : 'All Collections'}
        </h1>
        <p className="text-muted mt-2">
          {locale === 'vi'
            ? 'Khám phá các bộ sưu tập quà tặng theo chủ đề và dịp lễ đặc biệt.'
            : 'Discover curated gift collections for every occasion and season.'}
        </p>
      </header>

      {collections.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <p className="text-lg">No collections available right now.</p>
          <Link href={`/${locale}/products`} className="text-primary hover:underline mt-4 inline-block text-sm">
            Shop all products →
          </Link>
        </div>
      ) : (
        /* 2-col mobile → 3-col desktop grid */
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {collections.map((col) => {
            const imgSrc = col.bannerUrl ?? col.imageUrl;
            return (
              <Link
                key={col.id}
                href={`/${locale}/collections/${col.slug}`}
                className="group relative overflow-hidden rounded-card aspect-[4/3] bg-muted block"
              >
                {imgSrc ? (
                  <Image
                    src={imgSrc}
                    alt={col.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent group-hover:from-black/75 transition-colors duration-300" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-5">
                  <h2 className="font-display text-white font-bold text-base md:text-lg leading-tight mb-1">
                    {col.name}
                  </h2>
                  {col.productCount !== undefined && col.productCount > 0 && (
                    <p className="text-white/70 text-xs">
                      {col.productCount} {col.productCount === 1 ? 'product' : 'products'}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
