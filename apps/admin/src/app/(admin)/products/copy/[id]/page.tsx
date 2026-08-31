import { notFound } from 'next/navigation';
import { serverApi } from '../../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ProductEditShell } from '../../../../../components/products/edit/ProductEditShell';
import { buildCopyVariationDraft } from '../../../../../components/products/edit/helpers';
import type {
  AdminProductDto,
  AdminProductDetailDto,
  ProductVariantRow,
  VariationGroup,
  VariationSettings,
} from '../../../../../components/products/edit/types';

interface Props { params: Promise<{ id: string }> }

export default async function CopyProductPage({ params }: Props) {
  const { id } = await params;

  const [source, sourceDetail, variationGroups, variationSettings, variants] = await Promise.all([
    serverApi<AdminProductDto>('get', API_ROUTES.ADMIN.PRODUCT(id)).catch(() => null),
    serverApi<AdminProductDetailDto>('get', API_ROUTES.ADMIN.PRODUCT_DETAIL(id)).catch(() => null),
    serverApi<VariationGroup[]>('get', API_ROUTES.ADMIN.PRODUCT_VARIATIONS(id)).catch(() => []),
    serverApi<VariationSettings>('get', API_ROUTES.ADMIN.PRODUCT_VARIATION_SETTINGS(id)).catch(() => null),
    serverApi<ProductVariantRow[]>('get', API_ROUTES.ADMIN.PRODUCT_VARIATION_VARIANTS(id)).catch(() => []),
  ]);

  if (!source) notFound();

  return (
    <ProductEditShell
      copyFrom={source}
      copyFromDetail={sourceDetail}
      copyVariationDraft={buildCopyVariationDraft(
        variationGroups,
        variationSettings,
        variants,
        source.images,
      )}
    />
  );
}
