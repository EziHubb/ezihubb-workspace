'use client';

import { X } from 'lucide-react';
import { SearchFilterSidebar } from './SearchFilterSidebar';
import type { SearchFacets } from './SearchFilterSidebar';

interface MobileFilterSheetProps {
  filters: Record<string, string | undefined>;
  facets?: SearchFacets;
  onFilterChange: (key: string, value: string | null) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function MobileFilterSheet({
  filters,
  facets,
  onFilterChange,
  onClearAll,
  onClose,
}: MobileFilterSheetProps) {

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-[300px] bg-white z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <span className="font-semibold text-secondary">Filters</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="text-muted hover:text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <SearchFilterSidebar
            filters={filters}
            facets={facets}
            onFilterChange={onFilterChange}
            onClearAll={onClearAll}
          />
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-secondary text-white rounded-full py-3 text-sm font-medium hover:bg-primary transition-colors"
          >
            Show results
          </button>
        </div>
      </div>
    </>
  );
}
