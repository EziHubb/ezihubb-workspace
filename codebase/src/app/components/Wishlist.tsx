import { Heart, ShoppingCart, X, Share2 } from "lucide-react";
import { useState } from "react";
import { AccountLayout } from "./AccountLayout";

interface WishlistItem {
  id: number;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  inStock: boolean;
  lowStock?: boolean;
  badge?: "new" | "sale" | "hot";
}

const mockWishlistItems: WishlistItem[] = [
  {
    id: 1,
    name: "Custom Name & Photo Coffee Mug",
    image: "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=400",
    price: 27.99,
    originalPrice: 34.99,
    rating: 4.8,
    inStock: true,
    badge: "sale",
  },
  {
    id: 2,
    name: "Personalized Canvas Print",
    image: "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=400",
    price: 49.99,
    rating: 4.9,
    inStock: true,
    lowStock: true,
  },
  {
    id: 3,
    name: "Engraved Wooden Box",
    image: "https://images.unsplash.com/photo-1585847935950-36dcf94bf5ea?w=400",
    price: 39.99,
    rating: 4.7,
    inStock: true,
    badge: "new",
  },
  {
    id: 4,
    name: "Custom Photo Calendar 2024",
    image: "https://images.unsplash.com/photo-1506784871800-d8d48e5ea3d0?w=400",
    price: 29.99,
    rating: 4.6,
    inStock: false,
  },
  {
    id: 5,
    name: "Personalized Leather Wallet",
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400",
    price: 59.99,
    rating: 4.9,
    inStock: true,
    badge: "hot",
  },
  {
    id: 6,
    name: "Monogram Tumbler",
    image: "https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=400",
    price: 29.99,
    rating: 4.8,
    inStock: true,
  },
];

export function Wishlist() {
  const [wishlistItems, setWishlistItems] = useState(mockWishlistItems);
  const [addedToCart, setAddedToCart] = useState<number[]>([]);

  const removeItem = (id: number) => {
    setWishlistItems(wishlistItems.filter((item) => item.id !== id));
  };

  const addToCart = (id: number) => {
    setAddedToCart([...addedToCart, id]);
    setTimeout(() => {
      setAddedToCart(addedToCart.filter((itemId) => itemId !== id));
    }, 2000);
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case "new":
        return "bg-[var(--color-badge-new)]";
      case "sale":
        return "bg-[var(--color-badge-sale)]";
      case "hot":
        return "bg-[var(--color-badge-hot)]";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <AccountLayout activePage="wishlist">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-2xl mb-2">My Wishlist</h3>
            <p className="text-[var(--color-text-muted)]">
              {wishlistItems.length}{" "}
              {wishlistItems.length === 1 ? "item" : "items"} saved
            </p>
          </div>

          {wishlistItems.length > 0 && (
            <button className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors font-medium">
              <Share2 className="w-4 h-4" />
              Share Wishlist
            </button>
          )}
        </div>

        {/* Empty State */}
        {wishlistItems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 md:p-16 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Heart className="w-10 h-10 text-[var(--color-text-muted)]" />
            </div>
            <h4 className="font-semibold text-xl mb-2">
              Your wishlist is empty
            </h4>
            <p className="text-[var(--color-text-muted)] mb-6">
              Save items you love to easily find them later
            </p>
            <a
              href="/"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-3 rounded-lg transition-colors uppercase tracking-wide"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group"
              >
                {/* Remove Button */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute top-3 right-3 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Remove from wishlist"
                >
                  <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>

                {/* Badge */}
                {item.badge && (
                  <div
                    className={`absolute top-3 left-3 z-10 ${getBadgeColor(
                      item.badge
                    )} text-white px-3 py-1 rounded-[var(--radius-pill)] text-xs uppercase font-semibold tracking-wide`}
                  >
                    {item.badge}
                  </div>
                )}

                {/* Product Image */}
                <div className="aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h5 className="font-semibold mb-2 line-clamp-2">
                    {item.name}
                  </h5>

                  {/* Price */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[var(--color-primary)] font-semibold text-lg">
                      ${item.price.toFixed(2)}
                    </span>
                    {item.originalPrice && (
                      <span className="text-[var(--color-text-muted)] line-through text-sm">
                        ${item.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < Math.floor(item.rating)
                            ? "text-[var(--color-warning)]"
                            : "text-[var(--color-border)]"
                        }
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-sm text-[var(--color-text-muted)] ml-1">
                      ({item.rating})
                    </span>
                  </div>

                  {/* Stock Status */}
                  {!item.inStock ? (
                    <div className="mb-3">
                      <span className="text-sm text-[var(--color-error)]">
                        Out of Stock
                      </span>
                    </div>
                  ) : item.lowStock ? (
                    <div className="mb-3">
                      <span className="text-sm text-[var(--color-warning)]">
                        Only a few left!
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <span className="text-sm text-[var(--color-success)]">
                        In Stock
                      </span>
                    </div>
                  )}

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => addToCart(item.id)}
                    disabled={!item.inStock || addedToCart.includes(item.id)}
                    className={`w-full py-3 rounded-lg font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${
                      !item.inStock
                        ? "bg-gray-100 text-[var(--color-text-muted)] cursor-not-allowed"
                        : addedToCart.includes(item.id)
                        ? "bg-[var(--color-success)] text-white"
                        : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                    }`}
                  >
                    {!item.inStock ? (
                      "Out of Stock"
                    ) : addedToCart.includes(item.id) ? (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Added to Cart
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Move All to Cart Button */}
        {wishlistItems.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Love everything? Add all available items to your cart
            </p>
            <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-3 rounded-lg transition-colors uppercase tracking-wide">
              Move All to Cart
            </button>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
