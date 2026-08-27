'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Mail } from 'lucide-react';
import { SubscriptionStatusBadge, type SubscriptionStatusBadgeVariant } from '@ezihubb/ui';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAdminMode } from '../../../../lib/store-context';

// Mirrors SellerSubscriptionView from
// apps/api/src/modules/subscriptions/subscription-status.util.ts exactly.
interface SellerSubscriptionView {
  hasPlus:            boolean;
  displayStatus:      SubscriptionStatusBadgeVariant;
  cycle:               'MONTHLY' | 'ANNUAL' | null;
  priceAtPurchase:     number | null;
  currentPeriodStart:  string | null;
  currentPeriodEnd:    string | null;
  cancelAtPeriodEnd:   boolean;
}

const STATUS_LABELS: Record<SubscriptionStatusBadgeVariant, string> = {
  NONE:           'Not subscribed',
  ACTIVE:         'Active',
  CANCEL_PENDING: 'Ending soon',
  PAST_DUE:       'Past due',
  EXPIRED:        'Expired',
  REVOKED:        'Revoked',
};

// Distinct copy per state — never just the raw enum value.
const STATUS_COPY: Record<SubscriptionStatusBadgeVariant, string> = {
  NONE:           "You're on the free plan. Upgrade to Ezihubb Plus to unlock a custom colour theme and a higher Marketplace Insights quota.",
  ACTIVE:         'Your Ezihubb Plus subscription is active.',
  CANCEL_PENDING: "Your subscription won't renew, but you'll keep full Plus access until the end of the current period.",
  PAST_DUE:       'Your subscription is past due. Contact us to resolve your billing.',
  EXPIRED:        'Your Ezihubb Plus subscription has expired.',
  REVOKED:        'Your Ezihubb Plus subscription was cancelled.',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function EzihubbPlusPage() {
  const { ownStoreId, isPlatformContext, isReady } = useAdminMode();

  const { data, isLoading } = useQuery<SellerSubscriptionView>({
    queryKey: ['seller-subscription', ownStoreId],
    queryFn:  () => api.get<SellerSubscriptionView>(API_ROUTES.SELLER.SUBSCRIPTION),
    enabled:  isReady && !isPlatformContext && !!ownStoreId,
  });

  return (
    <>
      <AdminPageHeader
        title="Ezihubb Plus"
        subtitle="Your subscription status"
        queryKey={['seller-subscription', ownStoreId]}
      />

      {isLoading || !data ? (
        <div className="h-48 bg-surface border border-border rounded-card animate-pulse max-w-xl" />
      ) : (
        <div className="bg-surface rounded-card border border-border shadow-card p-4 sm:p-6 max-w-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-secondary">Ezihubb Plus</p>
              <SubscriptionStatusBadge status={data.displayStatus} label={STATUS_LABELS[data.displayStatus]} />
            </div>
          </div>

          <p className="text-sm text-secondary">{STATUS_COPY[data.displayStatus]}</p>

          {data.cycle && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Billing cycle</p>
                <p className="text-secondary">{data.cycle === 'MONTHLY' ? 'Monthly' : 'Annual'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Price</p>
                <p className="text-secondary">{data.priceAtPurchase != null ? `$${data.priceAtPurchase.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Current period</p>
                <p className="text-secondary">{formatDate(data.currentPeriodStart)} – {formatDate(data.currentPeriodEnd)}</p>
              </div>
            </div>
          )}

          {/* Read-only by design — no self-service purchase or cancel flow yet
              (Phase 1: manual grants only, no payment gateway). Managing a
              subscription is a SUPER_ADMIN action for now. */}
          <div className="pt-4 border-t border-border">
            <a
              href="mailto:support@ezihubb.com?subject=Ezihubb%20Plus"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-pill transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {data.hasPlus ? 'Contact us about your subscription' : 'Contact us to upgrade'}
            </a>
            {!data.hasPlus && (
              <p className="text-xs text-muted text-center mt-2">
                Colour themes are edited on the{' '}
                <Link href="/settings/shop-home" className="text-primary font-semibold hover:underline">Shop Home</Link> page once you're on Plus.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
