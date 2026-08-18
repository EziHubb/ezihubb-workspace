import { isEntitled, getDisplayStatus, toSellerView } from './subscription-status.util';
import type { StoreSubscription } from '@prisma/client';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const PAST = new Date('2026-08-01T00:00:00.000Z');
const FUTURE = new Date('2026-09-01T00:00:00.000Z');

function sub(overrides: Partial<StoreSubscription>): StoreSubscription {
  return {
    id: 'sub_1',
    storeId: 'store_1',
    status: 'ACTIVE',
    cycle: 'MONTHLY',
    priceAtPurchase: 5 as unknown as StoreSubscription['priceAtPurchase'],
    currentPeriodStart: PAST,
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    paymentProvider: 'MANUAL',
    externalSubscriptionId: null,
    grantedByUserId: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  };
}

describe('isEntitled', () => {
  it('returns false for null (store never had Plus)', () => {
    expect(isEntitled(null, NOW)).toBe(false);
  });

  it('returns true for ACTIVE still within period', () => {
    expect(isEntitled(sub({ status: 'ACTIVE', currentPeriodEnd: FUTURE }), NOW)).toBe(true);
  });

  it('returns false for ACTIVE whose period already ended (expired)', () => {
    expect(isEntitled(sub({ status: 'ACTIVE', currentPeriodEnd: PAST }), NOW)).toBe(false);
  });

  it('returns false for CANCELLED even if currentPeriodEnd is still in the future (immediate revoke, no grace)', () => {
    expect(isEntitled(sub({ status: 'CANCELLED', currentPeriodEnd: FUTURE }), NOW)).toBe(false);
  });

  it('returns false for PAST_DUE', () => {
    expect(isEntitled(sub({ status: 'PAST_DUE', currentPeriodEnd: FUTURE }), NOW)).toBe(false);
  });

  it('returns true for ACTIVE with cancelAtPeriodEnd=true, still within period (cancelled-but-still-entitled)', () => {
    expect(isEntitled(sub({ status: 'ACTIVE', cancelAtPeriodEnd: true, currentPeriodEnd: FUTURE }), NOW)).toBe(true);
  });
});

describe('getDisplayStatus', () => {
  it('NONE — no subscription row', () => {
    expect(getDisplayStatus(null, NOW)).toBe('NONE');
  });

  it('ACTIVE — normal active, not cancelled, not expired', () => {
    expect(getDisplayStatus(sub({ status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: FUTURE }), NOW)).toBe('ACTIVE');
  });

  it('CANCEL_PENDING — active, cancelAtPeriodEnd=true, still within period', () => {
    expect(getDisplayStatus(sub({ status: 'ACTIVE', cancelAtPeriodEnd: true, currentPeriodEnd: FUTURE }), NOW)).toBe('CANCEL_PENDING');
  });

  it('PAST_DUE — status is PAST_DUE', () => {
    expect(getDisplayStatus(sub({ status: 'PAST_DUE', currentPeriodEnd: FUTURE }), NOW)).toBe('PAST_DUE');
  });

  it('EXPIRED — status still ACTIVE but currentPeriodEnd has passed', () => {
    expect(getDisplayStatus(sub({ status: 'ACTIVE', currentPeriodEnd: PAST }), NOW)).toBe('EXPIRED');
  });

  it('REVOKED — status is CANCELLED (SUPER_ADMIN immediate revoke)', () => {
    expect(getDisplayStatus(sub({ status: 'CANCELLED', currentPeriodEnd: FUTURE }), NOW)).toBe('REVOKED');
  });
});

describe('toSellerView', () => {
  it('NONE state: hasPlus false, all fields null/false, no crash on a null sub', () => {
    const view = toSellerView(null, NOW);
    expect(view).toEqual({
      hasPlus: false,
      displayStatus: 'NONE',
      cycle: null,
      priceAtPurchase: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  it('ACTIVE: hasPlus true, mirrors isEntitled()/getDisplayStatus() exactly, priceAtPurchase is a real number not a Decimal/string', () => {
    const s = sub({ status: 'ACTIVE', currentPeriodEnd: FUTURE, priceAtPurchase: 5 as unknown as StoreSubscription['priceAtPurchase'] });
    const view = toSellerView(s, NOW);
    expect(view.hasPlus).toBe(true);
    expect(view.displayStatus).toBe('ACTIVE');
    expect(view.priceAtPurchase).toBe(5);
    expect(typeof view.priceAtPurchase).toBe('number');
    expect(view.cycle).toBe('MONTHLY');
    expect(view.currentPeriodEnd).toBe(FUTURE);
  });

  it('EXPIRED: hasPlus false (matches isEntitled), but displayStatus/dates still populated for the UI to show "expired on X"', () => {
    const s = sub({ status: 'ACTIVE', currentPeriodEnd: PAST });
    const view = toSellerView(s, NOW);
    expect(view.hasPlus).toBe(false);
    expect(view.displayStatus).toBe('EXPIRED');
    expect(view.currentPeriodEnd).toBe(PAST);
  });

  it('never exposes grantedByUserId, paymentProvider, or externalSubscriptionId', () => {
    const s = sub({ grantedByUserId: 'admin_1', paymentProvider: 'MANUAL', externalSubscriptionId: 'ext_123' });
    const view = toSellerView(s, NOW);
    expect(view).not.toHaveProperty('grantedByUserId');
    expect(view).not.toHaveProperty('paymentProvider');
    expect(view).not.toHaveProperty('externalSubscriptionId');
    expect(view).not.toHaveProperty('id');
    expect(view).not.toHaveProperty('storeId');
  });
});
