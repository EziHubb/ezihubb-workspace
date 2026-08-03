import { notFound } from 'next/navigation';
import { serverApi } from '../../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ProductEditShell } from '../../../../../components/products/edit/ProductEditShell';
import type { AdminProductDto, AdminProductDetailDto } from '../../../../../components/products/edit/types';

interface Props { params: Promise<{ id: string }> }

export default async function CopyProductPage({ params }: Props) {
  const { id } = await params;

  const [source, sourceDetail] = await Promise.all([
    serverApi<AdminProductDto>('get', API_ROUTES.ADMIN.PRODUCT(id)).catch(() => null),
    serverApi<AdminProductDetailDto>('get', API_ROUTES.ADMIN.PRODUCT_DETAIL(id)).catch(() => null),
  ]);

  if (!source) notFound();

  return (
    <ProductEditShell
      copyFrom={source}
      copyFromDetail={sourceDetail}
    />
  );
}
