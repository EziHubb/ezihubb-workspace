import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { serverFetch } from '../../../../../lib/api';
import { AdminPageHeader } from '../../../../../components/layout/AdminPageHeader';
import { ProductFormClient } from '../../../../../components/products/ProductFormClient';

interface Props { params: { id: string } }

export default async function EditProductPage({ params }: Props) {
  const res  = await serverFetch(`/admin/products/${params.id}`);
  if (!res.ok) notFound();

  const body    = await res.json();
  const product = body.data ?? body;

  return (
    <>
      <div className="flex items-center gap-2 mb-2 text-sm text-muted">
        <Link href="/products" className="hover:text-secondary transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Products
        </Link>
        <span>/</span>
        <span className="text-secondary font-medium">{product.name}</span>
      </div>
      <AdminPageHeader title={product.name} subtitle={`SKU: ${product.sku ?? 'N/A'} · /products/${product.slug}`} />
      <ProductFormClient product={product} />
    </>
  );
}
