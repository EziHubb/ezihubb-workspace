import type { Metadata } from 'next';
import { buildAlternates } from '../../../../../lib/seo';

/**
 * Exists only to carry metadata.
 *
 * The page in this folder is a Client Component, and a 'use client' module
 * cannot export `metadata` or `generateMetadata` — Next collects those on
 * the server. Without this it inherited the locale layout's
 * buildAlternates('/'), so the page declared itself a duplicate of the
 * homepage and asked to be dropped from the index.
 *
 * Renders children untouched: it adds a metadata boundary, not markup.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates('/affiliate/register', locale) };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
