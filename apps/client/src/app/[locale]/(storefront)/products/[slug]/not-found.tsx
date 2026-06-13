import Link from 'next/link';
import { PackageX } from 'lucide-react';

export default function ProductNotFound() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center min-h-[60vh] text-center py-20">
      <PackageX className="w-16 h-16 text-border mb-5" aria-hidden />

      <h1 className="font-display text-3xl font-bold text-secondary mb-3">
        Product not found
      </h1>
      <p className="text-muted mb-8 max-w-sm text-base">
        This product may have been removed or is no longer available. Browse
        our full collection to find something you&apos;ll love.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/search"
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          Browse All Products
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
