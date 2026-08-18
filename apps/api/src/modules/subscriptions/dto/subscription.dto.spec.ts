import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExtendSubscriptionDto } from './subscription.dto';

async function validateMonths(months: unknown) {
  const dto = plainToInstance(ExtendSubscriptionDto, { months });
  return validate(dto);
}

describe('ExtendSubscriptionDto — months validation', () => {
  it.each([
    ['0', 0],
    ['-1', -1],
    ['25 (over the 24-month cap)', 25],
    ['1.5 (not an integer)', 1.5],
    ['a string', 'twelve'],
    ['undefined', undefined],
  ])('rejects months = %s', async (_label, months) => {
    const errors = await validateMonths(months);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['1 (lower bound)', 1],
    ['24 (upper bound)', 24],
  ])('accepts months = %s', async (_label, months) => {
    const errors = await validateMonths(months);
    expect(errors).toHaveLength(0);
  });
});
