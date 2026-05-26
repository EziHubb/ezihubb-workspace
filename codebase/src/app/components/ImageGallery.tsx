import { useState } from "react";
import { ZoomIn } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  demandText?: string;
}

export function ImageGallery({ images, demandText }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="w-full">
      {/* Main Image */}
      <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden mb-3">
        <img
          src={images[activeIndex]}
          alt="Product"
          className="w-full aspect-square object-cover"
        />
      </div>

      {/* Demand Badge */}
      {demandText && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1.5 rounded-[var(--radius-pill)] text-sm font-medium">
            🔥 {demandText}
          </span>
        </div>
      )}

      {/* Thumbnail Strip */}
      <div className="flex items-center gap-3">
        <div className="flex gap-3 flex-1 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`shrink-0 w-[88px] h-[88px] rounded-lg overflow-hidden transition-all ${
                index === activeIndex
                  ? "border-2 border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                  : "border border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
              }`}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Zoom Caption */}
        <div className="hidden md:flex items-center gap-1 text-sm text-[var(--color-text-muted)] shrink-0">
          <ZoomIn className="w-4 h-4" />
          <span>Click to zoom</span>
        </div>
      </div>
    </div>
  );
}
