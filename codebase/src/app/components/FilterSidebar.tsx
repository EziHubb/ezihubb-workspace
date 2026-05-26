import { useState } from "react";
import { X } from "lucide-react";

interface FilterSidebarProps {
  onClearAll?: () => void;
  activeFilters?: number;
}

export function FilterSidebar({
  onClearAll,
  activeFilters = 0,
}: FilterSidebarProps) {
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [selectedCategories, setSelectedCategories] = useState(["Mugs"]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);

  const categories = [
    { name: "Mugs", count: 48 },
    { name: "Tumblers", count: 32 },
    { name: "Wine Glasses", count: 18 },
    { name: "Water Bottles", count: 26 },
  ];

  const occasions = [
    "Birthday",
    "Anniversary",
    "Christmas",
    "Graduation",
    "Pet Lover",
    "Couples",
  ];

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleOccasion = (occasion: string) => {
    setSelectedOccasions((prev) =>
      prev.includes(occasion)
        ? prev.filter((o) => o !== occasion)
        : [...prev, occasion]
    );
  };

  const removeFilter = (type: string, value: string) => {
    if (type === "category") {
      setSelectedCategories((prev) => prev.filter((c) => c !== value));
    } else if (type === "occasion") {
      setSelectedOccasions((prev) => prev.filter((o) => o !== value));
    } else if (type === "rating") {
      setSelectedRating(null);
    }
  };

  const activeFilterChips = [
    ...selectedCategories.map((c) => ({ type: "category", value: c })),
    ...selectedOccasions.map((o) => ({ type: "occasion", value: o })),
    ...(selectedRating ? [{ type: "rating", value: `${selectedRating}★ & up` }] : []),
  ];

  return (
    <div className="w-full md:w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Filters</h3>
        {activeFilters > 0 && (
          <button
            onClick={onClearAll}
            className="text-sm text-[var(--color-primary)] hover:underline font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {activeFilterChips.map((filter, index) => (
            <button
              key={index}
              onClick={() => removeFilter(filter.type, filter.value)}
              className="inline-flex items-center gap-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-pill)] text-sm font-medium hover:bg-[var(--color-primary)]/20 transition-colors"
            >
              {filter.value}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Price Range */}
      <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
        <h4 className="font-semibold text-sm mb-4 uppercase tracking-wide">
          Price Range
        </h4>
        <div className="space-y-4">
          {/* Price inputs */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Min
              </label>
              <input
                type="number"
                value={priceRange[0]}
                onChange={(e) =>
                  setPriceRange([parseInt(e.target.value), priceRange[1]])
                }
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-[var(--radius-button)] text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
            <span className="text-[var(--color-text-muted)] mt-5">—</span>
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Max
              </label>
              <input
                type="number"
                value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange([priceRange[0], parseInt(e.target.value)])
                }
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-[var(--radius-button)] text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
          </div>

          {/* Range slider */}
          <input
            type="range"
            min="0"
            max="200"
            value={priceRange[1]}
            onChange={(e) =>
              setPriceRange([priceRange[0], parseInt(e.target.value)])
            }
            className="w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Category */}
      <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
        <h4 className="font-semibold text-sm mb-4 uppercase tracking-wide">
          Category
        </h4>
        <div className="space-y-3">
          {categories.map((category) => (
            <label
              key={category.name}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.name)}
                onChange={() => toggleCategory(category.name)}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <span className="flex-1 text-sm group-hover:text-[var(--color-primary)] transition-colors">
                {category.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                ({category.count})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
        <h4 className="font-semibold text-sm mb-4 uppercase tracking-wide">
          Rating
        </h4>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() => setSelectedRating(rating)}
              className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg transition-colors ${
                selectedRating === rating
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${
                      i < rating
                        ? "text-[var(--color-warning)]"
                        : "text-[var(--color-border)]"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm">& up</span>
            </button>
          ))}
        </div>
      </div>

      {/* Occasion Tags */}
      <div className="mb-6">
        <h4 className="font-semibold text-sm mb-4 uppercase tracking-wide">
          Occasion
        </h4>
        <div className="flex flex-wrap gap-2">
          {occasions.map((occasion) => (
            <button
              key={occasion}
              onClick={() => toggleOccasion(occasion)}
              className={`px-4 py-2 rounded-[var(--radius-pill)] text-sm font-medium transition-colors ${
                selectedOccasions.includes(occasion)
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-[var(--color-secondary)] hover:bg-gray-200"
              }`}
            >
              {occasion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
