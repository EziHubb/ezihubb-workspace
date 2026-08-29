import { OrderStatus } from '@prisma/client';
import { leastAdvancedFulfilmentStatus } from './order-status-sync';

describe('leastAdvancedFulfilmentStatus', () => {
  it('keeps a multi-shop order at the least advanced shop milestone', () => {
    expect(leastAdvancedFulfilmentStatus([
      OrderStatus.SHIPPED,
      OrderStatus.IN_PRODUCTION,
      OrderStatus.DELIVERED,
    ])).toBe(OrderStatus.IN_PRODUCTION);
  });

  it('advances when every shop reaches the same milestone', () => {
    expect(leastAdvancedFulfilmentStatus([
      OrderStatus.SHIPPED,
      OrderStatus.SHIPPED,
    ])).toBe(OrderStatus.SHIPPED);
  });

  it('refuses to derive from an unrankable shop status', () => {
    expect(leastAdvancedFulfilmentStatus([
      OrderStatus.DELIVERED,
      OrderStatus.PENDING_PAYMENT,
    ])).toBeNull();
  });

  it('returns null when there are no active shop rows', () => {
    expect(leastAdvancedFulfilmentStatus([])).toBeNull();
  });
});
