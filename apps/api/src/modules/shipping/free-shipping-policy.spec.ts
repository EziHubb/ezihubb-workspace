import {
  DEFAULT_PLATFORM_FREE_SHIPPING_THRESHOLD,
  qualifiesForPlatformFreeShipping,
  resolveFreeShippingThreshold,
  resolveShippingSettlement,
} from './free-shipping-policy';

describe('platform free-shipping policy', () => {
  it('defaults to $100 when the stored setting is missing or invalid', () => {
    expect(resolveFreeShippingThreshold(undefined)).toBe(DEFAULT_PLATFORM_FREE_SHIPPING_THRESHOLD);
    expect(resolveFreeShippingThreshold('not-a-number')).toBe(DEFAULT_PLATFORM_FREE_SHIPPING_THRESHOLD);
  });

  it('accepts Prisma Decimal-like string values and includes the exact boundary', () => {
    const threshold = resolveFreeShippingThreshold('100.00');

    expect(qualifiesForPlatformFreeShipping(99.99, threshold)).toBe(false);
    expect(qualifiesForPlatformFreeShipping(100, threshold)).toBe(true);
  });

  it('treats zero as an explicit policy disable switch', () => {
    expect(qualifiesForPlatformFreeShipping(10_000, 0)).toBe(false);
  });

  it('records platform-sponsored delivery as an expense, not seller revenue', () => {
    expect(resolveShippingSettlement(7.5, { platformSponsored: true })).toEqual({
      buyerCharge: 0,
      platformSubsidy: 7.5,
      sellerCredit: 0,
    });
  });

  it('keeps seller-funded coupon waivers separate from platform support', () => {
    expect(resolveShippingSettlement(7.5, {
      platformSponsored: false,
      couponWaived: true,
    })).toEqual({
      buyerCharge: 0,
      platformSubsidy: 0,
      sellerCredit: 0,
    });
  });

  it('lets platform sponsorship take precedence when both policies apply', () => {
    expect(resolveShippingSettlement(7.5, {
      platformSponsored: true,
      couponWaived: true,
    })).toEqual({
      buyerCharge: 0,
      platformSubsidy: 7.5,
      sellerCredit: 0,
    });
  });
});
