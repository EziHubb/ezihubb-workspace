export interface BreadcrumbItem {
  name: string;
  url:  string;
}

export interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

/**
 * Injects BreadcrumbList JSON-LD structured data.
 * Place inside a Server Component page alongside the breadcrumb UI.
 *
 * @example
 * <BreadcrumbStructuredData items={[
 *   { name: 'Home', url: 'https://maplehandmade.com' },
 *   { name: 'Products', url: 'https://maplehandmade.com/products' },
 *   { name: 'Custom Mug', url: 'https://maplehandmade.com/products/custom-mug' },
 * ]} />
 */
export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  if (items.length === 0) return null;

  const data = {
    '@context':        'https://schema.org',
    '@type':           'BreadcrumbList',
    itemListElement:   items.map((item, idx) => ({
      '@type':   'ListItem',
      position:  idx + 1,
      name:      item.name,
      item:      item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
