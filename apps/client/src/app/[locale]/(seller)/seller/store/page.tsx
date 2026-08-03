'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Store } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useToast } from '@ezihubb/ui';

interface StoreSettings {
  name:        string;
  slug:        string;
  description: string | null;
  bannerUrl:   string | null;
  avatarUrl:   string | null;
  email:       string | null;
  website:     string | null;
}

export default function SellerStorePage() {
  const token  = useAuthStore((s) => s.accessToken);
  const toast  = useToast();
  const [form, setForm] = useState<Partial<StoreSettings>>({});

  const { data: store, isLoading } = useQuery<StoreSettings>({
    queryKey: ['store-me'],
    queryFn:  () => apiClient.get<StoreSettings>(API_ROUTES.SELLER.STORE_ME, { token: token ?? undefined }),
    enabled:  !!token,
  });

  useEffect(() => {
    if (store) setForm({ name: store.name, description: store.description ?? '', email: store.email ?? '', website: store.website ?? '' });
  }, [store]);

  const save = useMutation({
    mutationFn: (body: Partial<StoreSettings>) =>
      apiClient.patch(API_ROUTES.SELLER.STORE_ME_UPDATE, body, { token: token ?? undefined }),
    onSuccess: () => toast.success('Store settings saved'),
    onError:   () => toast.error('Failed to save settings'),
  });

  if (isLoading) return <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-secondary">Store Settings</h1>

      <div className="bg-surface border border-border rounded-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-secondary">{store?.name}</p>
            <p className="text-xs text-muted">/shops/{store?.slug}</p>
          </div>
        </div>

        {[
          { key: 'name',        label: 'Store name',   placeholder: 'Your store name' },
          { key: 'email',       label: 'Contact email', placeholder: 'store@example.com' },
          { key: 'website',     label: 'Website',       placeholder: 'https://yoursite.com' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-secondary mb-1.5">{label}</label>
            <input
              type="text"
              value={(form as Record<string, string>)[key] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Description</label>
          <textarea
            rows={4}
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Tell buyers about your shop…"
            className="w-full border border-border rounded-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
          />
        </div>

        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
