'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { ProductForm } from '../../../../components/products/ProductForm';

export default function NewProductPage() {
  return (
    <>
      <div className="flex items-center gap-2 mb-2 text-sm text-muted">
        <Link href="/products" className="hover:text-secondary transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Products
        </Link>
        <span>/</span>
        <span className="text-secondary font-medium">New Product</span>
      </div>
      <AdminPageHeader title="New Product" subtitle="Create a new product listing" />
      <ProductForm mode="create" />
    </>
  );
}
