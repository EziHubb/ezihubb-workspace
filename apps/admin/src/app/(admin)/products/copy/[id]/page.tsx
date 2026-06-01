import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../lib/api';
import { ProductEditShell } from '../../../../../components/products/edit/ProductEditShell';
import type { AdminProductDto, AdminProductDetailDto } from '../../../../../components/products/edit/types';

interface Props { params: Promise<{ id: string }> }

/**
 * Copy Product page.
 *
 * Fetches the source product, then renders the full 7-tab edit shell
 * in create mode with all fields pre-filled from the source.
 *
 * The original product is NOT modified.
 * A new product is created when the admin clicks "Create listing".
 */
export default async function CopyProductPage({ params }: Props) {
  const { id } = await params;

  const [productRes, detailRes] = await Promise.all([
    serverFetch(`/admin/products/${id}`),
    serverFetch(`/admin/products/${id}/detail`),
  ]);

  // If source doesn't exist, fall back to new product page
  if (!productRes.ok) notFound();

  const productBody = await productRes.json();
  const source = (productBody.data ?? productBody) as AdminProductDto;

  const detailBody     = detailRes.ok ? await detailRes.json() : null;
  const sourceDetail   = ((detailBody?.data ?? detailBody) ?? null) as AdminProductDetailDto | null;

  return (
    <ProductEditShell
      copyFrom={source}
      copyFromDetail={sourceDetail}
    />
  );
}
