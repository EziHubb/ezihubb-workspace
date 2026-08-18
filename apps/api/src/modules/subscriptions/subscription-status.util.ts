import type { StoreSubscription } from '@prisma/client';

// Single source of truth for "does this store currently have Plus" — every
// caller (EntitlementsService, getStoreBySlug, Marketplace Insights quota)
// goes through this, never re-derives it from `status` alone.
//
// There is no persisted EXPIRED status: a subscription whose
// `currentPeriodEnd` has passed is expired by definition, computed here on
// every read, never written back — no cron/lazy-update job, no second
// source of truth that can drift out of sync with the timestamp.
export function isEntitled(
  sub: Pick<StoreSubscription, 'status' | 'currentPeriodEnd'> | null,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  // CANCELLED = SUPER_ADMIN revoked immediately (see revokeImmediately) —
  // no grace period, unlike a seller's own "don't renew me" request, which
  // keeps status ACTIVE and only sets cancelAtPeriodEnd.
  // PAST_DUE is unreachable in Phase 1 (no card, no automatic billing) but
  // already excludes access here for when a real payment gateway lands.
  if (sub.status !== 'ACTIVE') return false;
  return sub.currentPeriodEnd > now;
}

// Display-only — never used to grant/deny access, only to render UI
// (Phase 3). Distinguishes states `isEntitled()` deliberately collapses.
export type DisplaySubscriptionStatus =
  | 'NONE'
  | 'ACTIVE'
  | 'CANCEL_PENDING'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'REVOKED';

export function getDisplayStatus(
  sub: StoreSubscription | null,
  now: Date = new Date(),
): DisplaySubscriptionStatus {
  if (!sub) return 'NONE';
  if (sub.status === 'CANCELLED') return 'REVOKED';
  if (sub.status === 'PAST_DUE') return 'PAST_DUE';
  if (sub.currentPeriodEnd <= now) return 'EXPIRED';
  if (sub.cancelAtPeriodEnd) return 'CANCEL_PENDING';
  return 'ACTIVE';
}

// Shared WHERE fragment for any query needing "stores that currently have
// Plus" (reports, dashboards, future). Bare `status: 'ACTIVE'` alone is
// wrong — always combine with the period-end check via this fragment.
export const ACTIVE_SUBSCRIPTION_WHERE = (now: Date = new Date()) => ({
  status: 'ACTIVE' as const,
  currentPeriodEnd: { gt: now },
});

// Restricted shape for the seller-facing GET /seller/subscription endpoint —
// deliberately omits `grantedByUserId`, `paymentProvider`,
// `externalSubscriptionId`, `id`, `storeId` (internal/admin-only fields, not
// the seller's business). `priceAtPurchase` IS included — it's what THEY are
// paying, not internal data. `hasPlus` is the ONLY field the frontend should
// gate UI on — computed here via isEntitled(), never re-derived from
// `displayStatus` string-matching in UI code (the exact bug class caught
// earlier in this feature's review — see LỖI 1/2 in the Phase 2 design).
export interface SellerSubscriptionView {
  hasPlus: boolean;
  displayStatus: DisplaySubscriptionStatus;
  cycle: StoreSubscription['cycle'] | null;
  priceAtPurchase: number | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function toSellerView(
  sub: StoreSubscription | null,
  now: Date = new Date(),
): SellerSubscriptionView {
  return {
    hasPlus:            isEntitled(sub, now),
    displayStatus:       getDisplayStatus(sub, now),
    cycle:               sub?.cycle ?? null,
    // Prisma Decimal → JSON serializes as a string, dropping trailing
    // zeros (verified earlier this session against the real decimal.js
    // package) — Number(...) here matches the established precedent at
    // products.service.ts:190.
    priceAtPurchase:     sub ? Number(sub.priceAtPurchase) : null,
    currentPeriodStart:  sub?.currentPeriodStart ?? null,
    currentPeriodEnd:    sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd:   sub?.cancelAtPeriodEnd ?? false,
  };
}
