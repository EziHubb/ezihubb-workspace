import { BadRequestException } from '@nestjs/common';
import { EtsyVariationPropertyDto } from './dto/etsy-variation-summary.dto';
import { CreateVariantDto } from './dto/create-product.dto';

export interface EtsyVariationGroup {
  name: string;
  options: string[];
}

export interface EtsyVariationSummaryResult {
  variants: CreateVariantDto[];
  groups: EtsyVariationGroup[];
  /** True whenever more than one property carries real (non-zero-spread) pricing — the case where the additive reconstruction below is only an estimate, not an exact price. */
  priceEstimated: boolean;
}

/**
 * Cross-joins Etsy's per-property price-range summary into full combination
 * variants. Since the summary only gives a min/max per option (not a price
 * per exact combination — see EtsyVariationSummaryDto's header comment for
 * why that can't be reconstructed exactly), this uses a best-effort additive
 * model: pick the property whose cheapest option's price is the overall
 * cheapest as the "base" axis, treat every other property's own price as a
 * delta over ITS cheapest option, and sum deltas onto the base. This exactly
 * reproduces each option's own price_min at that axis's cheapest combination,
 * but is only an estimate elsewhere (see `priceEstimated`) when more than one
 * property genuinely affects price — sellers should spot-check those variant
 * prices in admin after import.
 */
export function mapEtsyVariationSummaryToVariants(
  properties: EtsyVariationPropertyDto[],
): EtsyVariationSummaryResult {
  if (properties.length === 0) {
    throw new BadRequestException({
      code: 'ERR_ETSY_VARIATION_SUMMARY_EMPTY',
      message: 'etsyVariationSummary must include at least one property.',
    });
  }

  const groups: EtsyVariationGroup[] = properties.map((p) => ({
    name: p.name,
    options: p.options.map((o) => o.value),
  }));

  // Cheapest option per property, used as the zero-delta reference for that axis.
  const baseline = properties.map((p) =>
    p.options.reduce((min, o) => (o.price_min < min.price_min ? o : min), p.options[0]),
  );

  // More than one property with real price spread ⇒ the additive model below
  // is a guess for any combination that isn't all-cheapest or all-priciest.
  const propertiesWithSpread = properties.filter((p) =>
    p.options.some((o) => o.price_min !== baseline[properties.indexOf(p)].price_min),
  );
  const priceEstimated = propertiesWithSpread.length > 1;

  // Cartesian product across every property's options.
  let combinations: { name: string; propertyName: string; delta: number }[][] = [[]];
  properties.forEach((p, pi) => {
    const next: typeof combinations = [];
    for (const combo of combinations) {
      for (const opt of p.options) {
        next.push([
          ...combo,
          { name: opt.value, propertyName: p.name, delta: opt.price_min - baseline[pi].price_min },
        ]);
      }
    }
    combinations = next;
  });

  const overallBasePrice = Math.min(...baseline.map((b) => b.price_min));

  const variants = combinations.map((combo, index) => {
    const options: Record<string, string> = {};
    for (const c of combo) options[c.propertyName] = c.name;

    const totalDelta = combo.reduce((sum, c) => sum + c.delta, 0);
    const price = Math.round((overallBasePrice + totalDelta) * 100) / 100;

    return {
      name: combo.map((c) => c.name).join(' / '),
      options,
      price,
      isDefault: index === 0,
      sortOrder: index,
    } satisfies CreateVariantDto;
  });

  return { variants, groups, priceEstimated };
}
