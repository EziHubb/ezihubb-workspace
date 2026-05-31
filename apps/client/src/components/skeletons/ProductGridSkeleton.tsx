import { ProductCardSkeleton } from './ProductCardSkeleton';

interface ProductGridSkeletonProps {
  count?: number;
  cols?:  2 | 4;
}

const COL_CLASSES: Record<2 | 4, string> = {
  2: 'grid-cols-2',
  4: 'grid-cols-2 md:grid-cols-4',
};

export function ProductGridSkeleton({ count = 24, cols = 4 }: ProductGridSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading products"
      className={`grid ${COL_CLASSES[cols]} gap-4 md:gap-6`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
