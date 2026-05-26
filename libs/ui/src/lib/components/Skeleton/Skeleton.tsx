import React from 'react';

export type SkeletonVariant = 'text' | 'card' | 'circle' | 'rect';

export interface SkeletonProps {
  variant?:   SkeletonVariant;
  className?: string;
  width?:     string | number;
  height?:    string | number;
  lines?:     number;
}

const BASE = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%]';

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text:   'h-4 w-full rounded-sm',
  card:   'h-48 w-full rounded-card',
  circle: 'rounded-full',
  rect:   'rounded-sm',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant  = 'rect',
  className = '',
  width,
  height,
  lines = 1,
}) => {
  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={[
              BASE,
              VARIANT_CLASSES.text,
              i === lines - 1 ? 'w-3/4' : 'w-full',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={[BASE, VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')}
      style={{ width, height }}
    />
  );
};

// ── Presets ───────────────────────────────────────────────────────────────────

export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-card border border-border overflow-hidden">
    <Skeleton variant="rect" height={260} className="w-full rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton variant="text" className="w-3/4 h-4" />
      <Skeleton variant="text" className="w-1/2 h-3" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton variant="rect" className="w-16 h-5" />
        <Skeleton variant="circle" width={28} height={28} />
      </div>
    </div>
  </div>
);

export const OrderRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 py-4 border-b border-border last:border-0">
    <Skeleton variant="rect" width={64} height={64} className="shrink-0" />
    <div className="flex-1 space-y-2 min-w-0">
      <Skeleton variant="text" className="w-40 h-4" />
      <Skeleton variant="text" className="w-24 h-3" />
    </div>
    <div className="space-y-2 shrink-0">
      <Skeleton variant="text" className="w-16 h-4" />
      <Skeleton variant="rect" className="w-20 h-5 rounded-pill" />
    </div>
  </div>
);
