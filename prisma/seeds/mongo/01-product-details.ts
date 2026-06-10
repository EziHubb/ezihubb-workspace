import { IProductDetail, ProductDetailModel } from '../shared/mongo-schemas';

type DetailEntry = Omit<IProductDetail, 'productId'>;

const PRODUCT_DETAILS: Record<string, DetailEntry> = {
  'custom-name-photo-mug': {
    attributes: [
      { key: 'Material',       value: 'Ceramic',            filterable: true  },
      { key: 'Capacity',       value: '11oz / 15oz',        filterable: false },
      { key: 'Dishwasher Safe',value: 'Yes',                filterable: true  },
      { key: 'Microwave Safe', value: 'Yes',                filterable: false },
    ],
    variantOptions: [
      { name: 'Size',  values: ['11oz', '15oz'] },
      { name: 'Color', values: ['White', 'Black'] },
    ],
    printSpecs: { minDPI: 150, maxFileSize: 10, acceptedFormats: ['jpg','png','webp','heic'] },
  },
  'personalized-canvas-print': {
    attributes: [
      { key: 'Print Method', value: 'Giclée UV print',    filterable: false },
      { key: 'Frame',        value: 'Gallery wrap',       filterable: true  },
      { key: 'Material',     value: 'Poly-cotton canvas', filterable: false },
    ],
    variantOptions: [{ name: 'Size', values: ['12x16','16x20','20x24'] }],
    printSpecs: { minDPI: 200, maxFileSize: 20, acceptedFormats: ['jpg','png'] },
  },
  'monogram-tumbler': {
    attributes: [
      { key: 'Material',   value: 'Stainless Steel 18/8', filterable: true  },
      { key: 'Insulation', value: 'Double-wall vacuum',   filterable: false },
      { key: 'Cold',       value: '24 hours',             filterable: false },
      { key: 'Hot',        value: '12 hours',             filterable: false },
      { key: 'BPA Free',   value: 'Yes',                  filterable: true  },
    ],
    variantOptions: [{ name: 'Size', values: ['20oz','30oz'] }],
    printSpecs: { minDPI: 150, maxFileSize: 10, acceptedFormats: ['jpg','png','webp'] },
  },
  'personalized-cutting-board': {
    attributes: [
      { key: 'Material',       value: 'Bamboo', filterable: true  },
      { key: 'Food Safe',      value: 'Yes',    filterable: true  },
      { key: 'Juice Groove',   value: 'Yes',    filterable: false },
      { key: 'Engrave Method', value: 'Laser',  filterable: false },
    ],
    variantOptions: [{ name: 'Size', values: ['Small (8×6")','Large (12×8")'] }],
    printSpecs: { minDPI: 300, maxFileSize: 5, acceptedFormats: ['jpg','png','svg'] },
  },
  'custom-photo-phone-case': {
    attributes: [
      { key: 'Material',   value: 'Hard polycarbonate', filterable: false },
      { key: 'Print',      value: 'UV sublimation',     filterable: false },
      { key: 'Protection', value: 'Slim shell',         filterable: true  },
    ],
    variantOptions: [{ name: 'Model', values: ['iPhone 15','iPhone 15 Pro','iPhone 14','Samsung S24'] }],
    printSpecs: { minDPI: 150, maxFileSize: 10, acceptedFormats: ['jpg','png','webp','heic'] },
  },
  'custom-name-hoodie': {
    attributes: [
      { key: 'Material', value: '80% Cotton 20% Polyester', filterable: true  },
      { key: 'Fit',      value: 'Unisex regular',           filterable: false },
      { key: 'Care',     value: 'Machine wash cold',        filterable: false },
      { key: 'Print',    value: 'DTG (Direct-to-Garment)',  filterable: false },
    ],
    variantOptions: [
      { name: 'Size',  values: ['S','M','L','XL'] },
      { name: 'Color', values: ['Black'] },
    ],
    printSpecs: { minDPI: 150, maxFileSize: 10, acceptedFormats: ['jpg','png','webp'] },
  },
  'couples-mug-set': {
    attributes: [
      { key: 'Set includes',   value: '2 matching ceramic mugs', filterable: false },
      { key: 'Material',       value: 'Ceramic',                 filterable: true  },
      { key: 'Dishwasher Safe',value: 'Yes',                     filterable: true  },
      { key: 'Microwave Safe', value: 'Yes',                     filterable: false },
    ],
    variantOptions: [{ name: 'Size', values: ['2 × 11oz','2 × 15oz'] }],
    customization: {
      templateId:  'tmpl_couples_mug',
      version:     1,
      bundleCount: 2,
      fields: [
        { id: 'item_1_name',    type: 'text', label: 'Name on Mug 1',    required: true,  maxLength: 20, position: { x: 120, y: 80 } },
        { id: 'item_1_message', type: 'text', label: 'Message on Mug 1', required: false, maxLength: 30 },
        { id: 'item_2_name',    type: 'text', label: 'Name on Mug 2',    required: true,  maxLength: 20, position: { x: 120, y: 80 } },
        { id: 'item_2_message', type: 'text', label: 'Message on Mug 2', required: false, maxLength: 30 },
      ],
      previewLayers: [
        { type: 'base',    url: '/templates/mug-base.png',    zIndex: 0 },
        { type: 'overlay', url: '/templates/mug-overlay.png', zIndex: 2 },
      ],
    },
  },
};

export async function seedProductDetails(productIds: Record<string, string>) {
  console.log('  📄 Seeding MongoDB product details...');

  let created = 0;
  for (const [productSlug, detail] of Object.entries(PRODUCT_DETAILS)) {
    const productId = productIds[productSlug];
    if (!productId) continue;

    await ProductDetailModel.findOneAndUpdate(
      { productId },
      { productId, ...detail },
      { upsert: true, returnDocument: 'after' },
    );
    created++;
  }

  console.log(`    ✓ ${created} product detail documents`);
}
