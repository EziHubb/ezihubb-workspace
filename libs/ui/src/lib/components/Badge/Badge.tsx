import React from 'react';

// ── Product badges ────────────────────────────────────────────────────────────

export type ProductBadgeVariant = 'bestseller' | 'new' | 'sale' | 'hot';

export const PRODUCT_BADGE_CLASSES: Record<ProductBadgeVariant, string> = {
  bestseller: 'bg-primary-light text-primary border border-primary/20',
  new:        'bg-purple-50 text-purple-700 border border-purple-200',
  sale:       'bg-red-50 text-error border border-red-200',
  hot:        'bg-amber-50 text-warning border border-amber-200',
};

export const PRODUCT_BADGE_LABELS: Record<ProductBadgeVariant, string> = {
  bestseller: 'Bestseller',
  new:        'New',
  sale:       'Sale',
  hot:        'Hot',
};

// ── Order-status badges ───────────────────────────────────────────────────────

export type OrderStatusBadgeVariant =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'DISPUTED';

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatusBadgeVariant, string> = {
  PENDING_PAYMENT:  'bg-amber-50 text-amber-700 border border-amber-200',
  CONFIRMED:        'bg-blue-50 text-blue-700 border border-blue-200',
  IN_PRODUCTION:    'bg-violet-50 text-violet-700 border border-violet-200',
  SHIPPED:          'bg-cyan-50 text-cyan-700 border border-cyan-200',
  DELIVERED:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
  COMPLETED:        'bg-green-50 text-green-700 border border-green-200',
  CANCELLED:        'bg-gray-100 text-gray-500 border border-gray-200',
  REFUND_REQUESTED: 'bg-orange-50 text-orange-700 border border-orange-200',
  REFUNDED:         'bg-gray-100 text-gray-400 border border-gray-200',
  DISPUTED:         'bg-red-50 text-error border border-red-200',
};

export const ORDER_STATUS_LABELS: Record<OrderStatusBadgeVariant, string> = {
  PENDING_PAYMENT:  'Pending Payment',
  CONFIRMED:        'Confirmed',
  IN_PRODUCTION:    'In Production',
  SHIPPED:          'Shipped',
  DELIVERED:        'Delivered',
  COMPLETED:        'Completed',
  CANCELLED:        'Cancelled',
  REFUND_REQUESTED: 'Refund Requested',
  REFUNDED:         'Refunded',
  DISPUTED:         'Disputed',
};

// ── Subscription-status badges (Ezihubb Plus) ─────────────────────────────────
// Mirrors DisplaySubscriptionStatus from
// apps/api/src/modules/subscriptions/subscription-status.util.ts exactly —
// keep both in sync if that union ever changes.

export type SubscriptionStatusBadgeVariant =
  | 'NONE'
  | 'ACTIVE'
  | 'CANCEL_PENDING'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'REVOKED';

export const SUBSCRIPTION_STATUS_BADGE_CLASSES: Record<SubscriptionStatusBadgeVariant, string> = {
  NONE:           'bg-gray-100 text-gray-500 border border-gray-200',
  ACTIVE:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCEL_PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  PAST_DUE:       'bg-orange-50 text-orange-700 border border-orange-200',
  EXPIRED:        'bg-gray-100 text-gray-400 border border-gray-200',
  REVOKED:        'bg-red-50 text-error border border-red-200',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatusBadgeVariant, string> = {
  NONE:           'Not subscribed',
  ACTIVE:         'Active',
  CANCEL_PENDING: 'Ending soon',
  PAST_DUE:       'Past due',
  EXPIRED:        'Expired',
  REVOKED:        'Revoked',
};

// ── Generic Badge component ───────────────────────────────────────────────────

export type BadgeVariant = ProductBadgeVariant | OrderStatusBadgeVariant | SubscriptionStatusBadgeVariant | 'default';

export interface BadgeProps {
  children?:  React.ReactNode;
  variant?:   BadgeVariant;
  className?: string;
  size?:      'sm' | 'md';
}

const defaultClasses = 'bg-background text-muted border border-border';

function getVariantClasses(variant: BadgeVariant): string {
  if (variant === 'default') return defaultClasses;
  if (variant in PRODUCT_BADGE_CLASSES)
    return PRODUCT_BADGE_CLASSES[variant as ProductBadgeVariant];
  if (variant in ORDER_STATUS_BADGE_CLASSES)
    return ORDER_STATUS_BADGE_CLASSES[variant as OrderStatusBadgeVariant];
  if (variant in SUBSCRIPTION_STATUS_BADGE_CLASSES)
    return SUBSCRIPTION_STATUS_BADGE_CLASSES[variant as SubscriptionStatusBadgeVariant];
  return defaultClasses;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant  = 'default',
  className = '',
  size     = 'sm',
}) => {
  const label =
    children ??
    (variant in ORDER_STATUS_LABELS
      ? ORDER_STATUS_LABELS[variant as OrderStatusBadgeVariant]
      : variant in PRODUCT_BADGE_LABELS
        ? PRODUCT_BADGE_LABELS[variant as ProductBadgeVariant]
        : variant in SUBSCRIPTION_STATUS_LABELS
          ? SUBSCRIPTION_STATUS_LABELS[variant as SubscriptionStatusBadgeVariant]
          : variant);

  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-pill leading-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        getVariantClasses(variant),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </span>
  );
};

// ── Convenience: OrderStatusBadge ─────────────────────────────────────────────

export const OrderStatusBadge: React.FC<{
  status:    OrderStatusBadgeVariant;
  /** Translated label — overrides the built-in English default (e.g. "Shipped"). */
  label?:    string;
  size?:     'sm' | 'md';
  className?: string;
}> = ({ status, label, size, className }) => (
  <Badge variant={status} size={size} className={className}>
    {label}
  </Badge>
);

// ── Convenience: SubscriptionStatusBadge (Ezihubb Plus) ────────────────────────

export const SubscriptionStatusBadge: React.FC<{
  status:    SubscriptionStatusBadgeVariant;
  /** Translated label — overrides the built-in English default (e.g. "Active"). */
  label?:    string;
  size?:     'sm' | 'md';
  className?: string;
}> = ({ status, label, size, className }) => (
  <Badge variant={status} size={size} className={className}>
    {label}
  </Badge>
);
