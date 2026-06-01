import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../lib/api';
import { ProductEditShell } from '../../../../../components/products/edit/ProductEditShell';
import type { AdminProductDto, AdminProductDetailDto } from '../../../../../components/products/edit/types';

interface Props { params: Promise<{ id: string }> }

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [productRes, detailRes] = await Promise.all([
    serverFetch(`/admin/products/${id}`),
    serverFetch(`/admin/products/${id}/detail`),
  ]);

  if (!productRes.ok) notFound();

  const productBody = await productRes.json();
  const product = (productBody.data ?? productBody) as AdminProductDto;

  // detail is optional — product may not have a MongoDB document yet
  const detailBody = detailRes.ok ? await detailRes.json() : null;
  const detail     = ((detailBody?.data ?? detailBody) ?? null) as AdminProductDetailDto | null;

  return <ProductEditShell product={product} detail={detail} />;
}
