import type { ProductDto } from '@ezihubb/types';
import { EtsyGallery } from './EtsyGallery';

interface ProductGalleryColumnProps {
  product: ProductDto;
}

export function ProductGalleryColumn({ product }: ProductGalleryColumnProps) {
  return (
    <div>
      <EtsyGallery product={product} />
    </div>
  );
}
