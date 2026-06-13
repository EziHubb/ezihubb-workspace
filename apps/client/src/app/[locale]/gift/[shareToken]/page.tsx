'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Gift, Users, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GiftPoolContributor {
  id:            string;
  guestName:     string | null;
  amount:        number;
  contributedAt: string;
}

interface GiftPool {
  id:              string;
  shareToken:      string;
  title:           string;
  description:     string | null;
  targetAmount:    number;
  collectedAmount: number;
  status:          'OPEN' | 'COMPLETED' | 'EXPIRED';
  expiresAt:       string | null;
  product: {
    id:        string;
    name:      string;
    slug:      string;
    imageUrl:  string | null;
    basePrice: number;
  } | null;
  contributors: GiftPoolContributor[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day:   'numeric',
  year:  'numeric',
  hour:  'numeric',
  minute: '2-digit',
});

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="tabular-nums">{timeLeft}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GiftPoolPage() {
  const params     = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken;
  const t          = useTranslations('giftPool');
  const user       = useAuthStore((s) => s.user);

  const [pool,       setPool]       = useState<GiftPool | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchPool = useCallback(async () => {
    try {
      const data = await apiClient.get<GiftPool>(`/gift-pools/${shareToken}`);
      setPool(data);
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, [shareToken]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const [name,       setName]       = useState(user ? `${user.firstName} ${user.lastName}`.trim() : '');
  const [email,      setEmail]      = useState(user?.email ?? '');
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      setSubmitError(t('amountError'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post(`/gift-pools/${shareToken}/contribute`, {
        guestName: name.trim() || null,
        email:     email.trim() || null,
        amount:    amtNum,
      });
      setSuccess(true);
      await fetchPool();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('amountError');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (fetchError || !pool) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="w-14 h-14 text-error/50" />
        <div>
          <p className="font-semibold text-secondary text-lg">{t('notFound')}</p>
          <p className="text-sm text-muted mt-1">{t('notFoundSub')}</p>
        </div>
      </div>
    );
  }

  const pct         = Math.min(100, (pool.collectedAmount / pool.targetAmount) * 100);
  const isOpen      = pool.status === 'OPEN';
  const isCompleted = pool.status === 'COMPLETED';
  const isExpired   = pool.status === 'EXPIRED';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8">

        {/* Product card */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {pool.product?.imageUrl && (
            <div className="relative w-full aspect-[16/9] bg-background">
              <Image
                src={pool.product.imageUrl}
                alt={pool.product.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 576px"
              />
            </div>
          )}
          <div className="p-5 space-y-1">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary shrink-0" />
              <h1 className="font-display text-xl font-bold text-secondary line-clamp-2">
                {pool.title}
              </h1>
            </div>
            {pool.product && (
              <p className="text-sm text-muted">{pool.product.name} &mdash; ${pool.product.basePrice.toFixed(2)}</p>
            )}
            {pool.description && (
              <p className="text-sm text-muted mt-2">{pool.description}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-secondary tabular-nums">
              ${pool.collectedAmount.toFixed(2)} {t('raised')}
            </span>
            <span className="text-muted tabular-nums">
              {t('goal')} ${pool.targetAmount.toFixed(2)}
            </span>
          </div>
          <div className="h-3 bg-border/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t('contributors', { count: pool.contributors.length })}
            </span>
            {pool.expiresAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {isOpen ? (
                  <>{t('closesIn')} <Countdown expiresAt={pool.expiresAt} /></>
                ) : (
                  <>{t('closed')} {dateFmt.format(new Date(pool.expiresAt))}</>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Status banners */}
        {isCompleted && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">{t('goalReached')}</p>
              <p className="text-xs text-green-700">{t('goalReachedSub')}</p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="flex items-center gap-3 bg-muted/10 border border-border rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-muted shrink-0" />
            <div>
              <p className="text-sm font-semibold text-secondary">{t('expired')}</p>
              <p className="text-xs text-muted">{t('expiredSub')}</p>
            </div>
          </div>
        )}

        {/* Contribution form */}
        {isOpen && (
          <div className="bg-surface border border-border rounded-card p-5 space-y-5">
            <h2 className="font-semibold text-secondary">{t('contribute')}</h2>

            {success ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">{t('thankYou')}</p>
                  <p className="text-xs text-green-700">{t('thankYouSub')}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContribute} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      {t('yourName')} <span className="text-muted font-normal">{t('nameOptional')}</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('anonymous')}
                      className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      {t('email')} <span className="text-muted font-normal">{t('emailForReceipt')}</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    {t('amount')}
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className={[
                          'flex-1 py-2 text-sm font-medium border rounded-button transition-colors',
                          amount === String(preset)
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-secondary hover:border-primary/40',
                        ].join(' ')}
                      >
                        ${preset}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={t('amountPlaceholder')}
                      className="flex-1 border border-border rounded-input px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {submitError && <p className="text-xs text-error">{submitError}</p>}

                <button
                  type="submit"
                  disabled={submitting || !amount}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wide rounded-button py-3 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? t('processing') : t('contributeBtn')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Contributors list */}
        {pool.contributors.length > 0 && (
          <div className="bg-surface border border-border rounded-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-secondary text-sm">{t('contributorsTitle')}</h2>
            </div>
            <ul className="space-y-2">
              {pool.contributors.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-secondary">{c.guestName ?? t('anonymous')}</span>
                  <span className="font-semibold text-secondary tabular-nums">
                    ${c.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
