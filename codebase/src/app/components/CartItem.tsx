import { Minus, Plus, Trash2 } from "lucide-react";

interface CartItemProps {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
  customization?: string;
  onQuantityChange: (id: number, newQuantity: number) => void;
  onRemove: (id: number) => void;
}

export function CartItem({
  id,
  name,
  image,
  price,
  quantity,
  variant,
  customization,
  onQuantityChange,
  onRemove,
}: CartItemProps) {
  const lineTotal = price * quantity;

  return (
    <div className="bg-white rounded-2xl md:rounded-xl p-3 md:p-5 shadow-md mb-3 md:mb-4">
      {/* Desktop Layout */}
      <div className="hidden md:flex gap-4">
        {/* Thumbnail */}
        <div className="shrink-0">
          <img
            src={image}
            alt={name}
            className="w-[88px] h-[88px] rounded-lg object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Row 1: Name & Line Total */}
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-lg">{name}</h4>
            <p className="font-semibold text-lg ml-4">
              ${lineTotal.toFixed(2)}
            </p>
          </div>

          {/* Row 2: Variant */}
          {variant && (
            <p className="text-sm text-[var(--color-text-muted)] mb-1">
              {variant}
            </p>
          )}

          {/* Row 3: Customization */}
          {customization && (
            <p className="text-sm text-[var(--color-text-muted)] italic mb-3">
              {customization}
            </p>
          )}

          {/* Row 4: Quantity Control & Actions */}
          <div className="flex items-center justify-between mt-auto">
            {/* Quantity Control */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-[var(--color-border)] rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    onQuantityChange(id, Math.max(1, quantity - 1))
                  }
                  className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    onQuantityChange(id, Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-12 h-9 text-center border-x border-[var(--color-border)] focus:outline-none"
                  min="1"
                />
                <button
                  onClick={() => onQuantityChange(id, quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm text-[var(--color-text-muted)]">
                ${price.toFixed(2)}/each
              </span>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => onRemove(id)}
              className="flex items-center gap-2 text-sm text-[var(--color-error)] hover:underline font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Top Row: Thumbnail + Info */}
        <div className="flex gap-3 mb-3">
          <img
            src={image}
            alt={name}
            className="w-[72px] h-[72px] rounded-lg object-cover shrink-0"
          />

          <div className="flex-1 min-w-0">
            <h5 className="font-semibold text-base line-clamp-2 mb-1">
              {name}
            </h5>
            {variant && (
              <p className="text-xs text-[var(--color-text-muted)] mb-1 truncate">
                {variant}
              </p>
            )}
            {customization && (
              <p className="text-xs text-[var(--color-text-muted)] italic truncate">
                {customization}
              </p>
            )}
            <p className="font-bold text-[var(--color-primary)] mt-1">
              ${price.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Bottom Row: Quantity + Total + Remove */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          {/* Quantity Control - Smaller for mobile */}
          <div className="flex items-center border border-[var(--color-border)] rounded-lg overflow-hidden">
            <button
              onClick={() => onQuantityChange(id, Math.max(1, quantity - 1))}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-10 h-8 flex items-center justify-center border-x border-[var(--color-border)] text-sm font-medium">
              {quantity}
            </span>
            <button
              onClick={() => onQuantityChange(id, quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Line Total */}
          <p className="font-bold">${lineTotal.toFixed(2)}</p>

          {/* Remove */}
          <button
            onClick={() => onRemove(id)}
            className="text-xs text-[var(--color-error)] hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
