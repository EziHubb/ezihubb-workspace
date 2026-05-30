import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

export default function CollectionNotFound() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center min-h-[60vh] text-center py-20">
      <LayoutGrid className="w-16 h-16 text-border mb-5" aria-hidden />

      <h1 className="font-display text-3xl font-bold text-secondary mb-3">
        Collection not found
      </h1>
      <p className="text-muted mb-8 max-w-sm">
        This collection may have ended or been removed. Explore all our
        products or see what&apos;s available now.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/products"
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          Shop All Products
        </Link>
        <Link
          href="/"
          className="border border-border text-secondary font-semibold px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
