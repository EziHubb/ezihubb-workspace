'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';

type PlanType = 'COMMISSION' | 'SUBSCRIPTION';

const PLAN_OPTIONS: { value: PlanType; label: string; desc: string }[] = [
  {
    value: 'COMMISSION',
    label: 'Commission (Free)',
    desc:  'No monthly fee. We take a small % per sale. Best for new sellers.',
  },
  {
    value: 'SUBSCRIPTION',
    label: 'Subscription',
    desc:  'Monthly flat fee with lower commission. Best for established sellers with higher volume.',
  },
];

const SLUG_RE = /^[a-z0-9-]+$/;

export default function ApplyStorePage() {
  const locale = useLocale();
  const router = useRouter();

  const [name,        setName       ] = useState('');
  const [slug,        setSlug       ] = useState('');
  const [description, setDescription] = useState('');
  const [planType,    setPlanType   ] = useState<PlanType>('COMMISSION');
  const [slugError,   setSlugError  ] = useState('');

  const applyMutation = useAuthMutation(
    (vars: { name: string; slug: string; description: string; planType: PlanType }, token) =>
      apiClient.post('/stores/apply', vars, { token }),
    {
      onSuccess: () => router.replace(`/${locale}/seller`),
    },
  );

  const handleSlugChange = (v: string) => {
    const clean = v.toLowerCase().replace(/\s+/g, '-');
    setSlug(clean);
    if (clean && !SLUG_RE.test(clean)) {
      setSlugError('Only lowercase letters, numbers, and hyphens.');
    } else if (clean.length < 3) {
      setSlugError('Minimum 3 characters.');
    } else {
      setSlugError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slugError) return;
    applyMutation.mutate({ name, slug, description, planType });
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold text-secondary">Open Your Store</h1>
        <p className="text-muted mt-2">
          Join Daily Daisy as a seller and start reaching handmade-loving customers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Store name */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={100}
            placeholder="e.g. Daily Daisy Co."
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Slug / URL */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store URL <span className="text-error">*</span>
          </label>
          <div className="flex items-center border border-border rounded-button overflow-hidden focus-within:border-primary transition-colors">
            <span className="px-3 py-2.5 text-sm text-muted bg-background border-r border-border whitespace-nowrap">
              dailydaisy.com/shops/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              placeholder="your-store"
              className="flex-1 text-sm px-3 py-2.5 focus:outline-none"
            />
          </div>
          {slugError && <p className="text-xs text-error mt-1">{slugError}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Store description <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            placeholder="Tell buyers what your store is about, what you make, your story…"
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 resize-none focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-xs text-muted mt-1">{description.length}/2000</p>
        </div>

        {/* Plan type */}
        <div>
          <p className="text-sm font-medium text-secondary mb-2">Revenue plan</p>
          <div className="space-y-2">
            {PLAN_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  'flex items-start gap-3 p-3 border rounded-card cursor-pointer transition-colors',
                  planType === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="planType"
                  value={opt.value}
                  checked={planType === opt.value}
                  onChange={() => setPlanType(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-secondary">{opt.label}</p>
                  <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {applyMutation.isError && (
          <p className="text-sm text-error bg-error/5 border border-error/20 rounded-card p-3">
            {(applyMutation.error as Error)?.message ?? 'Something went wrong. Please try again.'}
          </p>
        )}

        <button
          type="submit"
          disabled={applyMutation.isPending || !!slugError}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3.5 rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {applyMutation.isPending ? 'Submitting…' : 'Submit Application'}
        </button>

        <p className="text-xs text-center text-muted">
          Applications are reviewed within 1–2 business days.
          You will receive an email once approved.
        </p>
      </form>
    </div>
  );
}
