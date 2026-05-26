import { useState } from "react";
import { Heart } from "lucide-react";

interface ProductCardProps {
  image: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviewCount?: number;
  badge?: "new" | "sale" | "hot" | "bestseller";
  lowStock?: boolean;
  className?: string;
}

export function ProductCard({
  image,
  name,
  price,
  originalPrice,
  rating = 5,
  reviewCount = 0,
  badge,
  lowStock = false,
  className = "",
}: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const badgeStyles = {
    new: "bg-[var(--color-badge-new)] text-white",
    sale: "bg-[var(--color-badge-sale)] text-white",
    hot: "bg-[var(--color-badge-hot)] text-white",
    bestseller: "bg-[var(--color-warning)] text-white",
  };

  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 relative group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge */}
      {badge && (
        <span
          className={`absolute top-2 left-2 z-10 rounded-[var(--radius-pill)] px-3 py-1 text-xs uppercase font-semibold tracking-wide ${badgeStyles[badge]}`}
        >
          {badge}
        </span>
      )}

      {/* Wishlist Heart */}
      <button
        onClick={() => setIsWishlisted(!isWishlisted)}
        className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={`w-5 h-5 transition-colors ${
            isWishlisted
              ? "fill-[var(--color-error)] text-[var(--color-error)]"
              : "text-[var(--color-text-muted)]"
          }`}
        />
      </button>

      {/* Image */}
      <div className="aspect-square mb-4 overflow-hidden rounded-lg bg-gray-100">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Product Info */}
      <h4 className="font-semibold text-lg mb-2 line-clamp-2">{name}</h4>

      {/* Price */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--color-primary)] font-semibold text-lg">
          ${price.toFixed(2)}
        </span>
        {originalPrice && (
          <span className="text-[var(--color-text-muted)] line-through text-sm">
            ${originalPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className={`text-sm ${
              i < Math.floor(rating)
                ? "text-[var(--color-warning)]"
                : "text-[var(--color-border)]"
            }`}
          >
            ★
          </span>
        ))}
        {reviewCount > 0 && (
          <span className="text-sm text-[var(--color-text-muted)] ml-1">
            ({reviewCount})
          </span>
        )}
      </div>

      {/* Low Stock Warning */}
      {lowStock && (
        <p className="text-xs text-[var(--color-error)] font-medium mb-3">
          ⚠️ Low stock
        </p>
      )}

      {/* CTA Button - Shows on hover */}
      {isHovered && (
        <button className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-sm uppercase tracking-wide rounded-[var(--radius-button)] py-3 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
          Personalize Now
        </button>
      )}
    </div>
  );
}
