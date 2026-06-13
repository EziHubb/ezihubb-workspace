import Link from 'next/link';
import { FolderX } from 'lucide-react';

export default function CategoryNotFound() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center min-h-[60vh] text-center py-20">
      <FolderX className="w-16 h-16 text-border mb-5" aria-hidden />

      <h1 className="font-display text-3xl font-bold text-secondary mb-3">
        Category not found
      </h1>
      <p className="text-muted mb-8 max-w-sm">
        This category doesn&apos;t exist or may have been removed. Browse all
        our products to find what you&apos;re looking for.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/search"
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
