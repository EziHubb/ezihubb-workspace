import type { ProductDetailDto } from '@ezihubb/types';
import { EtsyGallery } from './EtsyGallery';

interface ProductGalleryColumnProps {
  product: ProductDetailDto;
}

export function ProductGalleryColumn({ product }: ProductGalleryColumnProps) {
  return (
    <div>
      <EtsyGallery product={product} />
    </div>
  );
}
