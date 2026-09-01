import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePlatformSettingsDto } from './admin-stores.dto';
import {
  ShippingSupportOrdersQueryDto,
  ShippingSupportSummaryQueryDto,
} from './shipping-support-query.dto';

async function validateSettings(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdatePlatformSettingsDto, payload);
  return validate(dto);
}

describe('UpdatePlatformSettingsDto — plusMonthlyPrice / plusAnnualPrice', () => {
  it('accepts a valid plusMonthlyPrice', async () => {
    const errors = await validateSettings({ plusMonthlyPrice: 8 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative plusMonthlyPrice', async () => {
    const errors = await validateSettings({ plusMonthlyPrice: -1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-numeric plusMonthlyPrice', async () => {
    const errors = await validateSettings({ plusMonthlyPrice: 'eight' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid plusAnnualPrice', async () => {
    const errors = await validateSettings({ plusAnnualPrice: 50 });
    expect(errors).toHaveLength(0);
  });

  it('accepts an explicit null on plusAnnualPrice (clears the configured annual price)', async () => {
    const errors = await validateSettings({ plusAnnualPrice: null });
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative plusAnnualPrice', async () => {
    const errors = await validateSettings({ plusAnnualPrice: -5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  // NOT enforced, intentionally: no currency field in this DTO restricts
  // decimal places today (paymentProcessingFixedFee, listingFee,
  // minPayoutAmount all use bare `@IsNumber() @Min(0)`). Adding a
  // maxDecimalPlaces cap only to these 2 new fields would make them
  // stricter than every sibling money field for no stated reason — flagged
  // to the user as a decision point rather than invented here. This test
  // documents the actual (permissive) behavior, not a gap in itself.
  it('currently ACCEPTS excess decimal places on plusMonthlyPrice — matches every other currency field in this DTO, not a new gap', async () => {
    const errors = await validateSettings({ plusMonthlyPrice: 5.999999 });
    expect(errors).toHaveLength(0);
  });
});

describe('UpdatePlatformSettingsDto — offsiteAdsFeeRate', () => {
  it('accepts a valid rate within 0–0.5, same bounds as the other fee-rate fields', async () => {
    const errors = await validateSettings({ offsiteAdsFeeRate: 0.15 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative rate', async () => {
    const errors = await validateSettings({ offsiteAdsFeeRate: -0.01 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a rate above the 0.5 cap', async () => {
    const errors = await validateSettings({ offsiteAdsFeeRate: 0.51 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-numeric rate', async () => {
    const errors = await validateSettings({ offsiteAdsFeeRate: 'fifteen-percent' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdatePlatformSettingsDto — freeShippingThreshold', () => {
  it('accepts a non-negative threshold and zero as the disable value', async () => {
    await expect(validateSettings({ freeShippingThreshold: 100 })).resolves.toHaveLength(0);
    await expect(validateSettings({ freeShippingThreshold: 0 })).resolves.toHaveLength(0);
  });

  it('rejects negative and non-numeric thresholds', async () => {
    await expect(validateSettings({ freeShippingThreshold: -0.01 })).resolves.not.toHaveLength(0);
    await expect(validateSettings({ freeShippingThreshold: '100' })).resolves.not.toHaveLength(0);
  });
});

describe('Shipping support report query DTOs', () => {
  it('transforms and accepts supported reporting periods', async () => {
    const dto = plainToInstance(ShippingSupportSummaryQueryDto, { days: '90' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.days).toBe(90);
  });

  it('rejects arbitrary periods to keep finance queries bounded', async () => {
    const dto = plainToInstance(ShippingSupportSummaryQueryDto, { days: '9999' });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('bounds detail pagination and validates report filters', async () => {
    const valid = plainToInstance(ShippingSupportOrdersQueryDto, {
      days: '30', page: '2', limit: '100', status: 'realized', sort: 'subsidy',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);

    const invalid = plainToInstance(ShippingSupportOrdersQueryDto, {
      days: '30', page: '0', limit: '101', status: 'unknown',
    });
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
