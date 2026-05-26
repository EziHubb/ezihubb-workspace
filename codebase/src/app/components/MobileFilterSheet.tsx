import { X } from "lucide-react";
import { FilterSidebar } from "./FilterSidebar";

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters: number;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  activeFilters,
}: MobileFilterSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto md:hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--color-border)] px-4 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Filters</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="p-4">
          <FilterSidebar activeFilters={activeFilters} />
        </div>

        {/* Footer with Apply Button */}
        <div className="sticky bottom-0 bg-white border-t border-[var(--color-border)] px-4 py-4">
          <button
            onClick={onClose}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-4 rounded-[var(--radius-button)] transition-colors uppercase tracking-wide"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
