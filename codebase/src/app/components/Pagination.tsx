import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <nav className="flex items-center justify-center gap-2 mt-12">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:bg-transparent"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        <div key={index}>
          {page === "..." ? (
            <span className="px-3 py-2 text-[var(--color-text-muted)]">
              ...
            </span>
          ) : (
            <button
              onClick={() => onPageChange(page as number)}
              className={`min-w-[40px] h-[40px] rounded-lg font-medium transition-all ${
                currentPage === page
                  ? "bg-[var(--color-primary)] text-white shadow-md"
                  : "border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
              }`}
            >
              {page}
            </button>
          )}
        </div>
      ))}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:bg-transparent"
        aria-label="Next page"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </nav>
  );
}
