interface Variant {
  id: string;
  label: string;
  price?: number;
}

interface VariantSelectorProps {
  label: string;
  variants: Variant[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function VariantSelector({
  label,
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  const selectedVariant = variants.find((v) => v.id === selectedId);

  return (
    <div>
      <h5 className="font-semibold text-base mb-3">{label}</h5>

      {/* Variant Pills */}
      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => onSelect(variant.id)}
            className={`px-4 h-[44px] rounded-[var(--radius-pill)] font-medium text-sm transition-all ${
              variant.id === selectedId
                ? "bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                : "bg-white border border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)]/50"
            }`}
          >
            {variant.label}
            {variant.id === selectedId && " ✓"}
          </button>
        ))}
      </div>

      {/* Selected Info */}
      {selectedVariant && (
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          {selectedVariant.label} selected
          {selectedVariant.price && ` — $${selectedVariant.price.toFixed(2)}`}
        </p>
      )}
    </div>
  );
}
