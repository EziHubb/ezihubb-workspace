import React from 'react';
import Link from 'next/link';

// ── SVG illustrations ─────────────────────────────────────────────────────────

const ILLUSTRATIONS = {
  cart: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M20 26h4l6 24h20l4-16H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="33" cy="55" r="3" fill="#E85D3F" />
      <circle cx="51" cy="55" r="3" fill="#E85D3F" />
    </svg>
  ),
  orders: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <rect x="22" y="20" width="36" height="40" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path d="M29 31h22M29 39h22M29 47h14" stroke="#E85D3F" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  wishlist: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M40 55s-18-11.5-18-23a10 10 0 0120 0 10 10 0 0120 0C62 43.5 40 55 40 55z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <circle cx="36" cy="35" r="12" stroke="currentColor" strokeWidth="2.5" />
      <path d="M45 46l10 10" stroke="#E85D3F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 31h8M36 27v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  reviews: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M40 22l4.9 9.9 10.9 1.6-7.9 7.7 1.9 10.9L40 47.2l-9.8 5.1 1.9-10.9-7.9-7.7 10.9-1.6z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  products: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <rect x="21" y="21" width="16" height="16" rx="2" stroke="#E85D3F" strokeWidth="2.5" />
      <rect x="43" y="21" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <rect x="21" y="43" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <rect x="43" y="43" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  ),
  addresses: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M40 20c-8.8 0-16 7.2-16 16 0 12 16 24 16 24s16-12 16-24c0-8.8-7.2-16-16-16z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="40" cy="36" r="5" fill="#E85D3F" />
    </svg>
  ),
  notifications: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M40 22a14 14 0 00-14 14c0 5-3 10-3 10h34s-3-5-3-10a14 14 0 00-14-14z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M36 46a4 4 0 008 0" stroke="#E85D3F" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="22" r="3" fill="#E85D3F" />
    </svg>
  ),
  custom: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" />
      <path d="M40 28v12M40 46v4" stroke="#E85D3F" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
} as const;

export type EmptyStateIllustration = keyof typeof ILLUSTRATIONS;

// ── Action button ─────────────────────────────────────────────────────────────

interface ActionProps {
  label:    string;
  href?:    string;
  onClick?: () => void;
}

function ActionButton({ label, href, onClick, primary }: ActionProps & { primary?: boolean }) {
  const cls = primary
    ? 'inline-flex items-center justify-center px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors'
    : 'inline-flex items-center justify-center px-5 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors';

  if (href) {
    return <Link href={href} className={cls}>{label}</Link>;
  }
  return <button type="button" onClick={onClick} className={cls}>{label}</button>;
}

// ── Base component ────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  illustration:    EmptyStateIllustration;
  title:           string;
  description?:    string;
  action?:         ActionProps;
  secondaryAction?: { label: string; href: string };
  className?:      string;
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="text-muted/30 mb-6">
        {ILLUSTRATIONS[illustration]}
      </div>

      <h3 className="font-display text-xl font-bold text-secondary mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-muted max-w-xs mb-6">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          {action && <ActionButton {...action} primary />}
          {secondaryAction && (
            <ActionButton label={secondaryAction.label} href={secondaryAction.href} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Pre-configured convenience exports ───────────────────────────────────────

export function EmptyCart({ onShop }: { onShop?: () => void }) {
  return (
    <EmptyState
      illustration="cart"
      title="Your cart is empty"
      description="Looks like you haven't added anything yet. Explore our handmade gifts!"
      action={{ label: 'Start Shopping', href: '/products' }}
    />
  );
}

export function EmptyOrders() {
  return (
    <EmptyState
      illustration="orders"
      title="No orders yet"
      description="Your order history will appear here once you make your first purchase."
      action={{ label: 'Shop Now', href: '/products' }}
    />
  );
}

export function EmptyWishlist() {
  return (
    <EmptyState
      illustration="wishlist"
      title="Nothing saved yet"
      description="Tap the heart icon on any product to save it for later."
      action={{ label: 'Explore Gifts', href: '/products' }}
    />
  );
}

export function EmptySearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      illustration="search"
      title={`No results for "${query}"`}
      description="Try different keywords or browse our full collection."
      action={{ label: 'Browse All Products', href: '/products' }}
    />
  );
}

export function EmptyAddresses({ onAddAddress }: { onAddAddress?: () => void }) {
  return (
    <EmptyState
      illustration="addresses"
      title="No addresses saved"
      description="Save your shipping addresses for faster checkout."
      action={{ label: 'Add Address', onClick: onAddAddress }}
    />
  );
}

export function EmptyReviews({ onWriteReview }: { onWriteReview?: () => void }) {
  return (
    <EmptyState
      illustration="reviews"
      title="No reviews yet"
      description="Be the first to share your experience with this product!"
      action={{ label: 'Write a Review', onClick: onWriteReview }}
    />
  );
}
