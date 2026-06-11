'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Skeleton } from '@mlh/ui';
import { apiClient } from '@mlh/api-client';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';

interface StoreProfile {
  id:          string;
  name:        string;
  slug:        string;
  description: string | null;
  logoUrl:     string | null;
  bannerUrl:   string | null;
  status:      string;
  planType:    string;
  rating:      number;
  totalOrders: number;
  totalRevenue:number;
}

export default function SellerStorePage() {
  const locale = useLocale();

  const queryKey = ['seller', 'store', 'me'];
  const { data: store, isLoading } = useAuthQuery<StoreProfile>(queryKey, '/stores/me');

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

  const updateMutation = useAuthMutation(
    (vars: { name: string; description: string; logoUrl?: string; bannerUrl?: string }, token) =>
      apiClient.patch<StoreProfile>('/stores/me', vars, { token }),
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="rect" className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-bold text-secondary">Store Settings</h1>
        <a
          href={`/${locale}/shops/${store?.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View public page →
        </a>
      </div>

      {/* Stats row */}
      {store && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Orders',  value: store.totalOrders },
            { label: 'Rating',        value: store.rating.toFixed(1) },
            { label: 'Plan',          value: store.planType },
          ].map(({ label, value }) => (
            <div key={label} className="border border-border rounded-card p-4 text-center">
              <p className="text-xl font-bold text-secondary">{value}</p>
              <p className="text-xs text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Description <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={2000}
            rows={5}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 resize-none focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-xs text-muted mt-1">{description.length}/2000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Banner URL</label>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
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
          className="bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* Store URL info */}
      <div className="border border-border rounded-card p-4 bg-background">
        <p className="text-xs text-muted uppercase tracking-wider mb-1">Your Store URL</p>
        <p className="font-mono text-sm text-secondary">
          mapleloom.com/shops/{store?.slug}
        </p>
        <p className="text-xs text-muted mt-1">Store slug cannot be changed after approval.</p>
      </div>
    </div>
  );
}
