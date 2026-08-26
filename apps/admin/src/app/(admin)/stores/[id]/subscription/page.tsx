'use client';

import { useState, use, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, XCircle } from 'lucide-react';
import { SubscriptionStatusBadge, type SubscriptionStatusBadgeVariant } from '@ezihubb/ui';
import { api, ApiError } from '../../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreDetail { id: string; name: string }

interface PlatformSettingsLite { plusAnnualPrice: number | null }

// Raw StoreSubscription record — GET /admin/stores/:id/subscription is
// intentionally unrestricted (SUPER_ADMIN only). Prisma Decimal fields
// (priceAtPurchase) JSON-serialize as strings (verified this session), so
// typed as string here and Number()-coerced at render time.
interface RawSubscription {
  id:                  string;
  status:              'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  cycle:               'MONTHLY' | 'ANNUAL';
  priceAtPurchase:     string;
  currentPeriodStart:  string;
  currentPeriodEnd:    string;
  cancelAtPeriodEnd:   boolean;
  cancelledAt:         string | null;
}

// Mirrors getDisplayStatus() — recomputed client-side from the raw record's
// status/currentPeriodEnd/cancelAtPeriodEnd, same rules as the backend, so
// this page never has to trust a separately-shipped "displayStatus" field
// (GET .../subscription intentionally returns the raw record, not a view).
function displayStatus(sub: RawSubscription | null | undefined, now = new Date()): SubscriptionStatusBadgeVariant {
  if (!sub) return 'NONE';
  if (sub.status === 'CANCELLED') return 'REVOKED';
  if (sub.status === 'PAST_DUE') return 'PAST_DUE';
  if (new Date(sub.currentPeriodEnd) <= now) return 'EXPIRED';
  if (sub.cancelAtPeriodEnd) return 'CANCEL_PENDING';
  return 'ACTIVE';
}

const STATUS_LABELS: Record<SubscriptionStatusBadgeVariant, string> = {
  NONE: 'Not subscribed', ACTIVE: 'Active', CANCEL_PENDING: 'Ending soon',
  PAST_DUE: 'Past due', EXPIRED: 'Expired', REVOKED: 'Revoked',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StoreSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = use(params);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const sessionUser = session?.user as Record<string, unknown> | undefined;
  const role = sessionUser?.['role'] as string | undefined;

  // SUPER_ADMIN only page
  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [role, router]);

  const { data: store } = useQuery<StoreDetail>({
    queryKey: ['admin-store', storeId],
    queryFn:  () => api.get<StoreDetail>(API_ROUTES.ADMIN.STORE(storeId)),
  });

  const { data: sub, isLoading } = useQuery<RawSubscription | null>({
    queryKey: ['admin-store-subscription', storeId],
    queryFn:  () => api.get<RawSubscription | null>(API_ROUTES.ADMIN.STORE_SUBSCRIPTION(storeId)),
  });

  const { data: platformSettings } = useQuery<PlatformSettingsLite>({
    queryKey: ['admin-platform-settings'],
    queryFn:  () => api.get<PlatformSettingsLite>(API_ROUTES.ADMIN.PLATFORM_SETTINGS),
    staleTime: 60_000,
  });

  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [extendMonths, setExtendMonths] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-store-subscription', storeId] });

  const grantMut = useMutation({
    mutationFn: () => api.post(API_ROUTES.ADMIN.STORE_SUBSCRIPTION_GRANT(storeId), { cycle }),
    onSuccess:  () => { invalidate(); setActionError(null); },
    onError:    (err) => setActionError(err instanceof ApiError ? err.message : 'Could not grant Plus.'),
  });

  const extendMut = useMutation({
    mutationFn: () => api.patch(API_ROUTES.ADMIN.STORE_SUBSCRIPTION_EXTEND(storeId), { months: extendMonths }),
    onSuccess:  () => { invalidate(); setActionError(null); },
    onError:    (err) => setActionError(err instanceof ApiError ? err.message : 'Could not extend Plus.'),
  });

  const revokeMut = useMutation({
    mutationFn: (reason: string | undefined) => api.post(API_ROUTES.ADMIN.STORE_SUBSCRIPTION_REVOKE(storeId), { reason }),
    onSuccess:  () => { invalidate(); setActionError(null); },
    onError:    (err) => setActionError(err instanceof ApiError ? err.message : 'Could not revoke Plus.'),
  });

  const handleRevoke = async () => {
    const ok = await confirm(
      `Immediately revoke Ezihubb Plus for ${store?.name ?? 'this store'}? This takes effect right away — unlike a seller's own cancellation, there is no grace period.`,
      { title: 'Revoke Ezihubb Plus', confirmLabel: 'Revoke', destructive: true },
    );
    if (!ok) return;
    const reason = await prompt('Reason (optional, shown in the audit log):', { title: 'Revoke reason' });
    revokeMut.mutate(reason ?? undefined);
  };

  if (isLoading || !store) {
    return <div className="flex items-center justify-center py-24"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const status = displayStatus(sub);
  const annualAvailable = platformSettings ? platformSettings.plusAnnualPrice != null : false;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/stores/${storeId}`} className="mt-0.5 p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-secondary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Ezihubb Plus — {store.name}
          </h1>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <SubscriptionStatusBadge status={status} label={STATUS_LABELS[status]} />

        {sub && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Cycle</p>
              <p className="text-secondary">{sub.cycle === 'MONTHLY' ? 'Monthly' : 'Annual'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Price paid</p>
              <p className="text-secondary">${Number(sub.priceAtPurchase).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Current period</p>
              <p className="text-secondary">{formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}</p>
            </div>
          </div>
        )}

        {actionError && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-button text-xs text-error">
            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {actionError}
          </div>
        )}
      </div>

      {/* Grant */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-secondary">Grant Plus</h2>
        <p className="text-xs text-muted">Only available when the store doesn't already have an active subscription.</p>
        <div className="flex items-center gap-2">
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as 'MONTHLY' | 'ANNUAL')}
            className="px-3 py-2 text-sm border border-border rounded-button bg-background"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="ANNUAL" disabled={!annualAvailable}>
              Annual{!annualAvailable ? ' (price not configured)' : ''}
            </option>
          </select>
          <button
            onClick={() => grantMut.mutate()}
            disabled={grantMut.isPending}
            className="px-4 py-2 rounded-button text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {grantMut.isPending ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </div>

      {/* Extend */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-secondary">Extend</h2>
        <p className="text-xs text-muted">Adds time on top of the current period (or from now, if already expired). Requires an existing subscription.</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={24}
            value={extendMonths}
            onChange={(e) => setExtendMonths(Number(e.target.value))}
            className="w-24 px-3 py-2 text-sm border border-border rounded-button bg-background"
          />
          <span className="text-sm text-muted">month(s)</span>
          <button
            onClick={() => extendMut.mutate()}
            disabled={extendMut.isPending}
            className="px-4 py-2 rounded-button text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {extendMut.isPending ? 'Extending…' : 'Extend'}
          </button>
        </div>
      </div>

      {/* Revoke */}
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-error">Revoke immediately</h2>
        <p className="text-xs text-muted">Cuts off access right away — no grace period. Use for fraud, refunds, or a direct request to stop.</p>
        <button
          onClick={handleRevoke}
          disabled={revokeMut.isPending || !sub}
          className="px-4 py-2 rounded-button text-sm font-semibold bg-error text-white hover:opacity-90 disabled:opacity-40 transition-colors"
        >
          {revokeMut.isPending ? 'Revoking…' : 'Revoke'}
        </button>
      </div>
    </div>
  );
}
