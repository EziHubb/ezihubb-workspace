'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Gift, Loader2, AlertCircle, ArrowRight, Link2 } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../../lib/store/auth.store';

interface ProductSnippet {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  images?: { url: string }[];
}

function StartChainForm() {
  const router         = useRouter();
  const locale         = useLocale();
  const searchParams   = useSearchParams();
  const productId      = searchParams.get('productId') ?? '';
  const token          = useAuthStore((s) => s.accessToken);
  const user           = useAuthStore((s) => s.user);

  const [product,       setProduct]       = useState<ProductSnippet | null>(null);
  const [loadingProd,   setLoadingProd]   = useState(true);
  const [prodError,     setProdError]     = useState(false);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // Fetch product snippet by ID so we can show a preview
  useEffect(() => {
    if (!productId) { setLoadingProd(false); return; }
    apiClient
      .get<ProductSnippet>(`/products/${productId}`)
      .then((p) => setProduct(p))
      .catch(() => {
        // Non-fatal — still allow chain creation without the preview
        setProdError(true);
      })
      .finally(() => setLoadingProd(false));
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) { setError('Please enter the recipient email.'); return; }
    if (!productId) { setError('No product selected.'); return; }
    if (!token) {
      router.push(`/${locale}/login?redirect=/${locale}/chain/start?productId=${productId}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const chain = await apiClient.post<{ id: string }>(
        '/gift-chains',
        { productId, recipientEmail: recipientEmail.trim() },
        { token },
      );
      router.push(`/${locale}/chain/${chain.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start the gift chain. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const imageUrl = product?.images?.[0]?.url ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-16 space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            <Link2 className="w-3.5 h-3.5" />
            Gift Chain
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-secondary">
            Start a Gift Chain
          </h1>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Gift this item to a friend — they&apos;ll get 10% off and can pass it on to someone else.
          </p>
        </div>

        {/* Product card */}
        {loadingProd ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : prodError || !product ? (
          <div className="bg-surface border border-border rounded-card px-5 py-4 flex items-center gap-3 text-sm text-muted">
            <AlertCircle className="w-4 h-4 text-warning shrink-0" />
            Could not load product preview — you can still start the chain.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden flex items-center gap-4 p-4">
            {imageUrl && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-background">
                <Image src={imageUrl} alt={product.name} fill sizes="64px" className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-0.5">You&apos;re gifting</p>
              <p className="text-sm font-semibold text-secondary line-clamp-2">{product.name}</p>
              <p className="text-xs text-muted tabular-nums mt-0.5">${Number(product.basePrice).toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800">How it works</p>
          <ol className="text-xs text-amber-700 list-decimal list-inside space-y-0.5">
            <li>Enter your friend&apos;s email to send them this gift</li>
            <li>They receive a 10% discount code to buy it</li>
            <li>They pass the chain forward to someone else</li>
            <li>The gift keeps giving — each link saves 10%</li>
          </ol>
        </div>

        {/* Form */}
        {!user && !token ? (
          <div className="bg-surface border border-border rounded-card p-6 text-center space-y-4">
            <Gift className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm text-secondary font-medium">You need to be logged in to start a gift chain.</p>
            <Link
              href={`/${locale}/login?redirect=/${locale}/chain/start?productId=${productId}`}
              className="inline-block bg-primary hover:bg-primary-dark text-white text-sm font-bold px-6 py-2.5 rounded-button transition-colors"
            >
              Log in to continue
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Recipient&apos;s email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full border border-border rounded-input px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted mt-1">
                They&apos;ll receive an email with a link to claim their gift and a 10% discount.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !productId}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wide rounded-button py-3 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting chain…
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Start Gift Chain
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default function ChainStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <StartChainForm />
    </Suspense>
  );
}
