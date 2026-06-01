import { ProductEditShell } from '../../../../components/products/edit/ProductEditShell';

/**
 * New listing page — renders the full product edit shell in create mode.
 * No data fetching needed; shell starts with empty defaults.
 */
export default function NewProductPage() {
  return <ProductEditShell />;
}
