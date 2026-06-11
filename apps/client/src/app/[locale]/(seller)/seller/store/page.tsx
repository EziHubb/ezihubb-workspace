'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { CheckCircle2, Clock, AlertTriangle, ShoppingBag, Star, Package } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { apiClient } from '@mlh/api-client';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount } from '../../../../../lib/fmt';
import { CanvaConnectCard } from '../../../../../components/seller/CanvaConnectCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreProfile {
  id:           string;
  name:         string;
  slug:         string;
  description:  string | null;
  logoUrl:      string | null;
  bannerUrl:    string | null;
  status:       'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  planType:     string;
  rating:       number;
  totalOrders:  number;
  totalRevenue: number;
}

interface StoreApplication {
  status:     'PENDING' | 'ACTIVE' | 'REJECTED' | null;
  reviewNote: string | null;
  createdAt:  string | null;
}

interface ApplyPayload {
  storeName:   string;
  storeSlug:   string;
  description: string;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ACTIVE:    { label: 'Active',    icon: CheckCircle2,  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  PENDING:   { label: 'Pending review', icon: Clock,    color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  SUSPENDED: { label: 'Suspended', icon: AlertTriangle, color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   },
  REJECTED:  { label: 'Rejected',  icon: AlertTriangle, color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   },
};

// ── Apply form ────────────────────────────────────────────────────────────────

function ApplyForm({ onSuccess }: { onSuccess: () => void }) {
  const [storeName,   setStoreName  ] = useState('');
  const [storeSlug,   setStoreSlug  ] = useState('');
  const [description, setDescription] = useState('');

  const applyMutation = useAuthMutation(
    (vars: ApplyPayload, token: string) =>
      apiClient.post(API_ROUTES.SELLER.STORE_APPLY, vars, { token }),
    { onSuccess },
  );

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div className="space-y-6">
      <div className="p-5 bg-primary/5 border border-primary/20 rounded-card">
        <h2 className="font-semibold text-secondary mb-1">Apply to become a seller</h2>
        <p className="text-sm text-muted">
          Set up your store profile. Our team reviews applications within 1–2 business days.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyMutation.mutate({ storeName, storeSlug, description });
        }}
        className="space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store name <span className="text-error">*</span>
          </label>
          <input
            type="text" value={storeName} required maxLength={100}
            onChange={(e) => { setStoreName(e.target.value); if (!storeSlug) setStoreSlug(autoSlug(e.target.value)); }}
            placeholder="My Handmade Shop"
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store URL slug <span className="text-error">*</span>
          </label>
          <div className="flex items-center border border-border rounded-button overflow-hidden focus-within:border-primary transition-colors">
            <span className="px-3 py-2.5 bg-muted/10 text-muted text-sm border-r border-border">
              mapleloom.com/shops/
            </span>
            <input
              type="text" value={storeSlug} required pattern="[a-z0-9-]+" maxLength={60}
              onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-handmade-shop"
              className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted mt-1">Lowercase letters, numbers, hyphens only. Cannot be changed later.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store description <span className="text-error">*</span>
          </label>
          <textarea
            value={description} required maxLength={2000} rows={4}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell buyers what makes your store unique..."
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 resize-none focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-xs text-muted mt-1">{description.length}/2000</p>
        </div>

        {applyMutation.isError && (
          <p className="text-sm text-error">Failed to submit. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={applyMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-button transition-colors disabled:opacity-50"
        >
          {applyMutation.isPending ? 'Submitting…' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerStorePage() {
  const locale = useLocale();
  const [applied, setApplied] = useState(false);

  const { data: store, isLoading: storeLoading } = useAuthQuery<StoreProfile>(
    ['seller', 'store', 'me'],
    API_ROUTES.SELLER.STORE_ME,
  );

  const { data: application, isLoading: appLoading } = useAuthQuery<StoreApplication>(
    ['seller', 'store', 'application'],
    API_ROUTES.SELLER.STORE_APPLICATION,
  );

  const [name,        setName       ] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl,     setLogoUrl    ] = useState('');
  const [bannerUrl,   setBannerUrl  ] = useState('');

  useEffect(() => {
    if (store) {
      setName(store.name);
      setDescription(store.description ?? '');
      setLogoUrl(store.logoUrl   ?? '');
      setBannerUrl(store.bannerUrl ?? '');
    }
  }, [store]);

  const queryKey = ['seller', 'store', 'me'];
  const updateMutation = useAuthMutation(
    (vars: { name: string; description: string; logoUrl?: string; bannerUrl?: string }, token: string) =>
      apiClient.patch<StoreProfile>(API_ROUTES.SELLER.STORE_ME_UPDATE, vars, { token }),
    { invalidateKeys: [queryKey] },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name,
      description,
      logoUrl:   logoUrl   || undefined,
      bannerUrl: bannerUrl || undefined,
    });
  };

  const isLoading = storeLoading || appLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="rect" className="h-24 rounded-card" />
        <Skeleton variant="rect" className="h-64 rounded-card" />
      </div>
    );
  }

  // ── No store yet: show application status or apply form ───────────────────
  if (!store) {
    const appStatus = application?.status ?? null;

    if (applied || appStatus === 'PENDING') {
      return (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-secondary">Store Settings</h1>
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-card flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-secondary">Application under review</p>
              <p className="text-sm text-muted mt-1">
                Our team is reviewing your application. You will be notified once it's approved (usually 1–2 business days).
              </p>
              {application?.createdAt && (
                <p className="text-xs text-muted mt-2">
                  Submitted: {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(application.createdAt))}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (appStatus === 'REJECTED') {
      return (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-secondary">Store Settings</h1>
          <div className="p-5 bg-red-50 border border-red-200 rounded-card flex items-start gap-4 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Previous application rejected</p>
              {application?.reviewNote && (
                <p className="text-sm text-red-700 mt-1">{application.reviewNote}</p>
              )}
              <p className="text-sm text-muted mt-1">You may reapply with updated information.</p>
            </div>
          </div>
          <ApplyForm onSuccess={() => setApplied(true)} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-secondary">Store Settings</h1>
        <ApplyForm onSuccess={() => setApplied(true)} />
      </div>
    );
  }

  // ── Store exists: show status banner + edit form ──────────────────────────
  const cfg = STATUS_CFG[store.status] ?? STATUS_CFG['ACTIVE'];
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-bold text-secondary">Store Settings</h1>
        <a
          href={`/${locale}/shops/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View public page →
        </a>
      </div>

      {/* ── Status banner ─────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 p-4 rounded-card border ${cfg.bg} ${cfg.border}`}>
        <StatusIcon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${cfg.color}`}>Store status: {cfg.label}</p>
          {store.status === 'SUSPENDED' && (
            <p className="text-xs text-red-600 mt-0.5">Your store is suspended. Contact support to restore access.</p>
          )}
          {store.status === 'PENDING' && (
            <p className="text-xs text-amber-700 mt-0.5">Your store is under review. It will go live once approved.</p>
          )}
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: ShoppingBag, label: 'Total Orders',   value: String(store.totalOrders),            sub: 'all time',       color: 'bg-blue-500'  },
          { icon: Star,        label: 'Rating',          value: store.rating?.toFixed(1) ?? '–',      sub: 'store average',  color: 'bg-amber-500' },
          { icon: Package,     label: 'Plan',            value: store.planType ?? 'Free',              sub: 'current plan',   color: 'bg-green-500' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-lg font-bold text-secondary tabular-nums">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Edit form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store name <span className="text-error">*</span>
          </label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            required maxLength={100}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Description <span className="text-error">*</span>
          </label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            required maxLength={2000} rows={5}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 resize-none focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-xs text-muted mt-1">{description.length}/2000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Logo URL</label>
          <input
            type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Banner URL</label>
          <input
            type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {updateMutation.isSuccess && (
          <p className="text-sm text-green-600 font-medium">Store settings saved.</p>
        )}
        {updateMutation.isError && (
          <p className="text-sm text-error">Failed to save. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-button transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* ── Store URL info ────────────────────────────────────────────────── */}
      <div className="border border-border rounded-card p-4 bg-background">
        <p className="text-xs text-muted uppercase tracking-wider mb-1">Your Store URL</p>
        <p className="font-mono text-sm text-secondary">mapleloom.com/shops/{store.slug}</p>
        <p className="text-xs text-muted mt-1">Store slug cannot be changed after approval.</p>
      </div>

      {/* ── Canva Integration (NFT-09) ────────────────────────────────────── */}
      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-3">Integrations</p>
        <CanvaConnectCard />
      </div>
    </div>
  );
}
