/**
 * Seller fee calculation modeled on Etsy's published fee schedule:
 * https://www.etsy.com/legal/fees — transaction fee + payment processing fee
 * + (conditionally) a regulatory operating fee. Etsy charges these on every
 * seller uniformly (no per-seller negotiated rate), so all inputs here come
 * from the single platform-wide PlatformSettings row.
 *
 * Applied to `subtotal + shippingCost` for both transaction and payment
 * processing fees (no sales tax is calculated or charged on this platform).
 */

export interface OrderFeeSettings {
  transactionFeeRate:        number;
  paymentProcessingFeeRate:  number;
  paymentProcessingFixedFee: number;
  regulatoryFeeRate:         number;
  regulatoryFeeCountries:    string[];
  /** VAT charged on top of the seller's other platform fees (Etsy: "VAT on
   *  seller fees") — applied unconditionally, unlike regulatoryFee. */
  vatOnFeesRate:              number;
}

export interface OrderFeeBreakdown {
  transactionFee:        number;
  paymentProcessingFee:  number;
  regulatoryFee:          number;
  vatOnFees:              number;
  totalFees:              number;
  sellerEarnings:         number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function calculateOrderFees(
  subtotal:      number,
  shippingCost:  number,
  storeCountry:  string | null | undefined,
  settings:      OrderFeeSettings,
): OrderFeeBreakdown {
  const base = subtotal + shippingCost;

  const transactionFee       = round2(base * settings.transactionFeeRate);
  const paymentProcessingFee = round2(base * settings.paymentProcessingFeeRate + settings.paymentProcessingFixedFee);
  const regulatoryFee        = storeCountry && settings.regulatoryFeeCountries.includes(storeCountry.toUpperCase())
    ? round2(base * settings.regulatoryFeeRate)
    : 0;
  const vatOnFees            = round2((transactionFee + paymentProcessingFee + regulatoryFee) * settings.vatOnFeesRate);

  const totalFees     = round2(transactionFee + paymentProcessingFee + regulatoryFee + vatOnFees);
  const sellerEarnings = round2(base - totalFees);

  return { transactionFee, paymentProcessingFee, regulatoryFee, vatOnFees, totalFees, sellerEarnings };
}
