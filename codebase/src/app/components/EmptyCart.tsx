import { ShoppingBag } from "lucide-react";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4">
      {/* Icon */}
      <div className="w-32 h-32 mb-6 flex items-center justify-center">
        <ShoppingBag className="w-full h-full text-[var(--color-primary)]/20 stroke-1" />
      </div>

      {/* Heading */}
      <h3 className="font-['Playfair_Display'] font-semibold text-2xl md:text-3xl text-[var(--color-secondary)] mb-3">
        Your cart is empty
      </h3>

      {/* Description */}
      <p className="text-[var(--color-text-muted)] text-center mb-8 max-w-md">
        Looks like you haven't added any personalized gifts yet.
      </p>

      {/* CTA Button */}
      <a
        href="/"
        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-4 rounded-lg transition-colors text-base uppercase tracking-wide inline-block mb-4"
      >
        Start Shopping
      </a>

      {/* Browse Collections Link */}
      <a
        href="#collections"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
      >
        ← or browse our collections
      </a>
    </div>
  );
}
