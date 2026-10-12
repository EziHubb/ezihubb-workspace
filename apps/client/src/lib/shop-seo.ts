import type { Metadata } from 'next';
import { buildAlternates } from './seo';

interface ShopSeoDetails {
  name: string;
  description: string | null;
  aboutHeadline: string | null;
  tagline: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
}

interface ShopMetadataOptions {
  slug: string;
  locale: string;
  formatTitle: (name: string) => string;
  formatDescription: (name: string) => string;
}

/** Keep document and sharing metadata consistent, including legacy blank fields. */
export function buildShopMetadata(
  store: ShopSeoDetails,
  { slug, locale, formatTitle, formatDescription }: ShopMetadataOptions,
): Metadata {
  const name = store.name.trim() || slug;
  const shopTitle = formatTitle(name);
  // The platform's own shop already includes the brand in its name.
  const title = name.toLowerCase() === 'ezihubb' ? shopTitle : `${shopTitle} | EziHubb`;
  const description = (
    [store.description, store.aboutHeadline, store.tagline]
      .map((value) => value?.trim())
      .find((value) => Boolean(value))
    || formatDescription(name)
  ).slice(0, 160);
  const image = store.bannerUrl?.trim() || store.logoUrl?.trim() || '/og-default.jpg';
  const alternates = buildAlternates(`/shops/${slug}`, locale);

  return {
    title: { absolute: title },
    description,
    alternates,
    openGraph: {
      title,
      description,
      siteName: 'EziHubb',
      type: 'website',
      url: alternates.canonical,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@ezihubb',
      creator: '@ezihubb',
      title,
      description,
      images: [image],
    },
  };
}
