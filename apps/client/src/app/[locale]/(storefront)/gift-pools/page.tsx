'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Gift, Users, Clock, Plus, Loader2, AlertCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GiftPoolPreview {
  id:              string;
  title:           string;
  shareToken:      string;
  targetAmount:    number;
  collectedAmount: number;
  status:          string;
  deadline:        string;
  product: { name: string; imageUrl?: string | null } | null;
  _count?: { contributions: number };
}

interface CreatePoolPayload {
  productId:       string;
  recipientName:   string;
  targetAmount:    number;
  deadline:        string;
  giftMessage?:    string;
  shippingAddress: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 bg-border/30 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setLabel('Expired'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setLabel(d > 0 ? `${d}d ${h}h left` : `${h}h left`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [deadline]);
  return <span>{label}</span>;
}

// ── Create Pool Modal ─────────────────────────────────────────────────────────

function CreatePoolModal({ token, onClose, onCreated }: {
  token: string;
  onClose: () => void;
  onCreated: (shareToken: string) => void;
}) {
  const locale = useLocale();
  const [productId,  setProductId]  = useState('');
  const [recipient,  setRecipient]  = useState('');
  const [target,     setTarget]     = useState('');
  const [days,       setDays]       = useState('30');
  const [message,    setMessage]    = useState('');

  const mutation = useMutation({
    mutationFn: (payload: CreatePoolPayload) =>
      apiClient.post<{ shareToken: string }>(API_ROUTES.GIFT_POOLS.CREATE, payload, { token }),
    onSuccess: (data) => {
      if (data?.shareToken) onCreated(data.shareToken);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const deadline = new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString();
    mutation.mutate({
      productId:       productId.trim(),
      recipientName:   recipient.trim(),
      targetAmount:    parseFloat(target),
      deadline,
      giftMessage:     message.trim() || undefined,
      shippingAddress: {},
    });
  }

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-secondary text-lg">Start a Gift Pool</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Product ID</label>
            <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Enter product ID" required className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Recipient name</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Sarah" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Target ($)</label>
              <input type="number" min="1" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="100" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Duration (days)</label>
              <input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Gift message (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="A heartfelt note..." className={`${inputCls} resize-none`} />
          </div>

          {mutation.isError && (
            <div className="flex items-start gap-2 p-2.5 bg-error/8 border border-error/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
              <p className="text-xs text-error">Failed to create pool. Please try again.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-button transition-colors"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? 'Creating…' : 'Create Gift Pool'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Pool card ─────────────────────────────────────────────────────────────────

function PoolCard({ pool, locale }: { pool: GiftPoolPreview; locale: string }) {
  const pct = pool.targetAmount > 0
    ? Math.min(100, (pool.collectedAmount / pool.targetAmount) * 100)
    : 0;
  const isActive = pool.status === 'ACTIVE';

  return (
    <div className="bg-surface border border-border rounded-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-secondary line-clamp-1">{pool.title}</p>
          {pool.product && <p className="text-xs text-muted line-clamp-1">{pool.product.name}</p>}
          <span className={[
            'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1',
            isActive ? 'bg-green-50 text-green-700' : 'bg-muted/10 text-muted',
          ].join(' ')}>
            {pool.status}
          </span>
        </div>
      </div>

      <ProgressBar pct={pct} />

      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {pool._count?.contributions ?? 0} contributors
        </span>
        <span className="font-bold text-primary tabular-nums">
          ${pool.collectedAmount.toFixed(0)} / ${pool.targetAmount.toFixed(0)}
        </span>
      </div>

      {pool.deadline && isActive && (
        <div className="flex items-center gap-1 text-xs text-muted">
          <Clock className="w-3 h-3" />
          <Countdown deadline={pool.deadline} />
        </div>
      )}

      <Link
        href={`/${locale}/gift/${pool.shareToken}`}
        className="block w-full text-center text-xs font-semibold border border-border hover:border-primary hover:text-primary rounded-button py-2 transition-colors"
      >
        View pool →
      </Link>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: '1', title: 'Pick a gift',    desc: 'Choose a product you want to gift' },
  { step: '2', title: 'Invite friends', desc: 'Share the pool link so everyone can chip in' },
  { step: '3', title: 'We deliver',     desc: 'Once the goal is reached we handle the rest' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GiftPoolsPage() {
  const locale = useLocale();
  const user   = useAuthStore((s) => s.user);
  const token  = useAuthStore((s) => s.accessToken);
  const [showModal, setShowModal] = useState(false);

  const { data: pools, isLoading, refetch } = useQuery<GiftPoolPreview[]>({
    queryKey: ['gift-pools-my'],
    queryFn:  () => apiClient.get<GiftPoolPreview[]>(API_ROUTES.GIFT_POOLS.MY_POOLS, { token: token ?? undefined }),
    enabled:  !!token && !!user,
    select:   (d) => Array.isArray(d) ? d : [],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">

        {/* Hero */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Users className="w-3.5 h-3.5" /> Group gifting made easy
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary">
            Gift Pools
          </h1>
          <p className="text-muted max-w-xl mx-auto">
            Pool money with friends and family to buy the perfect gift together.
          </p>
          {user && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 mt-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> New Gift Pool
            </button>
          )}
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mx-auto">
                {step}
              </div>
              <p className="font-semibold text-secondary text-sm">{title}</p>
              <p className="text-xs text-muted">{desc}</p>
            </div>
          ))}
        </div>

        {/* Auth gate */}
        {!user ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <Users className="w-12 h-12 text-muted/30" />
            <p className="text-secondary font-semibold">Sign in to create or view your gift pools</p>
            <Link
              href={`/${locale}/login?redirect=/gift-pools`}
              className="px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-button hover:bg-primary-dark transition-colors"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-secondary text-lg">Your pools</h2>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Plus className="w-4 h-4" /> New pool
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : !pools || pools.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Gift className="w-12 h-12 text-muted/30" />
                <p className="text-secondary font-semibold">No gift pools yet</p>
                <p className="text-sm text-muted">Start a pool and invite friends to chip in!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pools.map((pool) => (
                  <PoolCard key={pool.id} pool={pool} locale={locale} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && token && (
        <CreatePoolModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={(shareToken) => {
            setShowModal(false);
            refetch();
            window.location.href = `/${locale}/gift/${shareToken}`;
          }}
        />
      )}
    </div>
  );
}
