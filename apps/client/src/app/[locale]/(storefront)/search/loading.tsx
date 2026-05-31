import { ProductGridSkeleton } from '../../../../components/skeletons/ProductGridSkeleton';
const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function SearchLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8" aria-busy="true">
      <div className={`h-12 w-full max-w-2xl mx-auto mb-8 rounded-button ${S}`} />
      <ProductGridSkeleton count={12} cols={4} />
    </div>
  );
}
