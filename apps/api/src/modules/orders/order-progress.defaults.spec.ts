import { OrderProgressStepKind, OrderStatus } from '@prisma/client';
import { publicStatusForProgressKind } from './order-progress.defaults';

describe('publicStatusForProgressKind', () => {
  it.each([
    [OrderProgressStepKind.CONFIRMED,     OrderStatus.CONFIRMED],
    [OrderProgressStepKind.IN_PRODUCTION, OrderStatus.IN_PRODUCTION],
    [OrderProgressStepKind.CUSTOM,        OrderStatus.IN_PRODUCTION],
    [OrderProgressStepKind.SHIPPED,       OrderStatus.SHIPPED],
    [OrderProgressStepKind.DELIVERED,     OrderStatus.DELIVERED],
    [OrderProgressStepKind.COMPLETED,     OrderStatus.COMPLETED],
  ])('maps %s to %s', (kind, status) => {
    expect(publicStatusForProgressKind(kind)).toBe(status);
  });
});
