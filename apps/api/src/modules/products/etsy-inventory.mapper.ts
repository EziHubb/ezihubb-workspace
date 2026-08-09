import { BadRequestException } from '@nestjs/common';
import { EtsyInventoryDto } from './dto/etsy-inventory.dto';
import { CreateVariantDto } from './dto/create-product.dto';

/**
 * Maps Etsy's real Listing Inventory shape (one row per concrete SKU, each
 * with its own price) directly onto our internal flat-variant format — no
 * cartesian-product generation or price-formula guessing involved, since
 * Etsy's `products[]` is already the complete, correct combination list.
 */
export function mapEtsyInventoryToVariants(inventory: EtsyInventoryDto): CreateVariantDto[] {
  return inventory.products.map((product, index) => {
    const offering = product.offerings.find((o) => o.is_enabled !== false) ?? product.offerings[0];
    if (!offering) {
      throw new BadRequestException({
        code: 'ERR_ETSY_INVENTORY_INVALID',
        message: `Etsy inventory product at index ${index} has no offerings`,
      });
    }

    const options: Record<string, string> = {};
    for (const pv of product.property_values) {
      const key = pv.property_name ?? `property_${pv.property_id ?? index}`;
      options[key] = pv.values[0] ?? '';
    }

    const name = Object.values(options).filter(Boolean).join(' / ') || `Variant ${index + 1}`;
    const price = offering.price.divisor
      ? offering.price.amount / offering.price.divisor
      : offering.price.amount;

    return {
      name,
      options,
      price: Math.round(price * 100) / 100,
      sku: product.sku,
      isDefault: index === 0,
      sortOrder: index,
    } satisfies CreateVariantDto;
  });
}
