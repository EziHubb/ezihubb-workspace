import React from 'react';

export interface RatingStarsProps {
  rating:       number;
  reviewCount?: number;
  size?:        'sm' | 'md';
  interactive?: boolean;
  onChange?:    (value: number) => void;
}

const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  reviewCount,
  size        = 'sm',
  interactive = false,
  onChange,
}) => {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const display = hovered ?? rating;

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const value = i + 1;
        const filled = display >= value;
        const half   = !filled && display >= value - 0.5;

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            aria-label={`${value} star${value !== 1 ? 's' : ''}`}
            className={[
              'relative shrink-0',
              iconClass,
              interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none',
            ].join(' ')}
            onClick={() => onChange?.(value)}
            onMouseEnter={() => interactive && setHovered(value)}
            onMouseLeave={() => interactive && setHovered(null)}
          >
            {/* empty (background) star */}
            <svg
              className={`absolute inset-0 ${iconClass} text-border`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d={STAR_PATH} />
            </svg>

            {/* filled / half-filled overlay */}
            {(filled || half) && (
              <svg
                className={`absolute inset-0 ${iconClass} text-warning`}
                viewBox="0 0 20 20"
                fill="currentColor"
                style={half ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
              >
                <path d={STAR_PATH} />
              </svg>
            )}
          </button>
        );
      })}

      {reviewCount !== undefined && reviewCount > 0 && (
        <span className={`${textClass} text-muted ml-1`}>({reviewCount})</span>
      )}
    </div>
  );
};
