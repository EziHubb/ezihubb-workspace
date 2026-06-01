'use client';

import { useRouter } from 'next/navigation';
import { ProductForm, type ProductPayload } from './ProductForm';

export function ProductFormClient({ product }: { product: ProductPayload }) {
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <ProductForm
      mode="edit"
      initial={product}
      onSuccess={handleSuccess}
    />
  );
}
