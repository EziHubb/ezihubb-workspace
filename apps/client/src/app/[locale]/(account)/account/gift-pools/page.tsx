'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Gift,
  Users,
  Clock,
  Copy,
  Link as LinkIcon,
  ChevronRight,
  Check,
  X,
  Loader2,
  Plus,
} from 'lucide-react';
import { useToast, Modal, ModalHeader, ModalBody, ModalFooter, Button, Skeleton } from '@ezihubb/ui';
import { apiClient } from '@ezihubb/api-client';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';

// ── Types ─────────────────────────────────────────────────────────────────────

type PoolStatus = 'ACTIVE' | 'FUNDED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

interface GiftPoolContributor {
  id:        string;
  name:      string;
  avatarUrl: string | null;
}

interface GiftPool {
  id:               string;
  title:            string;
  recipientName:    string;
  status:           PoolStatus;
  targetAmount:     number;
  raisedAmount:     number;
  deadline:         string;
  shareToken:       string;
  productImageUrl:  string | null;
  contributors:     GiftPoolContributor[];
  contributorCount: number;
}

interface GiftPoolsResponse {
  pools: GiftPool[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getProgressPct(raised: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

function getDeadlineLabel(deadline: string): { label: string; urgent: boolean } {
  const now  = Date.now();
  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { label: 'Expired', urgent: false };
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days       = Math.floor(totalHours / 24);
  const hours      = totalHours % 24;
  if (days === 0) return { label: `${hours}h left`, urgent: true };
  if (days < 3)   return { label: `${days}d ${hours}h left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

const STATUS_LABEL: Record<PoolStatus, string> = {
  ACTIVE:    'Active',
  FUNDED:    'Funded',
  COMPLETED: 'Completed',
  EXPIRED:   'Expired',
  CANCELLED: 'Cancelled',
};

const STATUS_BADGE: Record<PoolStatus, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  FUNDED:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  EXPIRED:   'bg-red-100 text-red-700',
  CANCELLED: 'bg-zinc-100 text-zinc-500',
};

const TAB_STATUSES: Record<string, PoolStatus[]> = {
  Active:    ['ACTIVE'],
  Funded:    ['FUNDED'],
  Completed: ['COMPLETED'],
  Expired:   ['EXPIRED'],
  Cancelled: ['CANCELLED'],
};

// ── Extend Modal ──────────────────────────────────────────────────────────────

function ExtendModal({
  pool,
  onClose,
  onExtended,
}: {
  pool:       GiftPool;
  onClose:    () => void;
  onExtended: () => void;
}) {
  const toast = useToast();
  const [days, setDays] = useState<3 | 5 | 7>(3);

  const newDeadline = new Date(
    new Date(pool.deadline).getTime() + days * 24 * 60 * 60 * 1000,
  );

  const extendMutation = useAuthMutation(
    (vars: { days: number }, token: string) =>
      apiClient.patch<void>(`/gift-pools/${pool.id}/extend`, { days: vars.days }, { token }),
    {
      onSuccess: () => {
        toast.success('Deadline extended!');
        onExtended();
        onClose();
      },
    },
  );

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalHeader>
        <h2 className="font-semibold text-secondary">Extend Deadline</h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted mb-4">Choose how many extra days to add to the pool deadline.</p>
        <div className="flex gap-2 mb-5">
          {([3, 5, 7] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`flex-1 py-2 text-sm font-semibold rounded-button border transition-colors ${
                days === d
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-secondary hover:bg-background'
              }`}
            >
              +{d} days
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          New deadline:{' '}
          <span className="font-semibold text-secondary">
            {newDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={extendMutation.isPending}
          onClick={() => extendMutation.mutate({ days }, { onError: () => toast.error('Failed to extend deadline') })}
        >
          Confirm Extension
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({
  pool,
  onClose,
  onCancelled,
}: {
  pool:        GiftPool;
  onClose:     () => void;
  onCancelled: () => void;
}) {
  const toast = useToast();

  const cancelMutation = useAuthMutation(
    (_: void, token: string) =>
      apiClient.delete<void>(`/gift-pools/${pool.id}`, { token }),
    {
      onSuccess: () => {
        toast.success('Pool cancelled. Contributions will be refunded.');
        onCancelled();
        onClose();
      },
    },
  );

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalHeader>
        <h2 className="font-semibold text-secondary">Cancel Gift Pool</h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-sm text-secondary mb-2">
          Are you sure you want to cancel <span className="font-semibold">{pool.title}</span>?
        </p>
        {pool.raisedAmount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 text-sm text-amber-800">
            {formatMoney(pool.raisedAmount)} raised by {pool.contributorCount} contributor{pool.contributorCount !== 1 ? 's' : ''} will be fully refunded.
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Keep Pool
        </Button>
        <Button
          variant="destructive"
          loading={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate(undefined, { onError: () => toast.error('Failed to cancel pool') })}
        >
          Yes, Cancel Pool
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── Avatar stack ──────────────────────────────────────────────────────────────

function AvatarStack({ contributors, count }: { contributors: GiftPoolContributor[]; count: number }) {
  const shown = contributors.slice(0, 4);
  const extra = count - shown.length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {shown.map((c) => (
          <div
            key={c.id}
            className="w-6 h-6 rounded-full border-2 border-white bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden shrink-0"
          >
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              c.name[0]?.toUpperCase()
            )}
          </div>
        ))}
        {extra > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-border flex items-center justify-center text-[9px] font-bold text-muted shrink-0">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-xs text-muted">
        <Users className="inline w-3 h-3 mr-0.5" />
        {count} contributor{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── Pool Card ─────────────────────────────────────────────────────────────────

function PoolCard({
  pool,
  onRefetch,
}: {
  pool:      GiftPool;
  onRefetch: () => void;
}) {
  const toast              = useToast();
  const [copied, setCopied] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const pct      = getProgressPct(pool.raisedAmount, pool.targetAmount);
  const deadline = getDeadlineLabel(pool.deadline);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/gift-pools/${pool.shareToken}`
    : `https://ezihubb.com/gift-pools/${pool.shareToken}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const surplus = pool.raisedAmount - pool.targetAmount;

  return (
    <>
      <article className="bg-surface border border-border rounded-card overflow-hidden">
        {pool.status === 'FUNDED' && (
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 text-xs font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Goal reached! Order being placed…
          </div>
        )}
        {pool.status === 'EXPIRED' && (
          <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 text-xs font-semibold">
            <X className="w-3.5 h-3.5" />
            Pool expired before reaching goal. All contributions refunded.
          </div>
        )}
        {pool.status === 'ACTIVE' && surplus > 0 && (
          <div className="flex items-center gap-2 bg-amber-400 text-amber-900 px-4 py-2 text-xs font-semibold">
            Pool exceeded goal by {formatMoney(surplus)}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-card overflow-hidden bg-background shrink-0 border border-border">
              {pool.productImageUrl ? (
                <img src={pool.productImageUrl} alt={pool.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gift className="w-6 h-6 text-muted/40" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-secondary text-sm leading-snug truncate">
                  {pool.title}
                </h3>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[pool.status]}`}>
                  {STATUS_LABEL[pool.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-4 bg-background rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary font-medium tabular-nums">
                {formatMoney(pool.raisedAmount)} <span className="text-muted font-normal">of {formatMoney(pool.targetAmount)} raised</span>
              </span>
              <span className={deadline.urgent ? 'text-amber-600 font-semibold flex items-center gap-1' : 'text-muted flex items-center gap-1'}>
                <Clock className="w-3 h-3" />
                {deadline.label}
              </span>
            </div>
          </div>

          <AvatarStack contributors={pool.contributors} count={pool.contributorCount} />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-button px-3 py-1.5 text-secondary hover:bg-background transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-button px-3 py-1.5 text-secondary hover:bg-background transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              View public page
              <ChevronRight className="w-3 h-3 text-muted" />
            </a>
            {pool.status === 'ACTIVE' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowExtend(true)}
                  className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-button px-3 py-1.5 text-secondary hover:bg-background transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Extend deadline
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancel(true)}
                  className="flex items-center gap-1.5 text-xs font-medium border border-error/30 rounded-button px-3 py-1.5 text-error hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel pool
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      {showExtend && (
        <ExtendModal pool={pool} onClose={() => setShowExtend(false)} onExtended={onRefetch} />
      )}
      {showCancel && (
        <CancelModal pool={pool} onClose={() => setShowCancel(false)} onCancelled={onRefetch} />
      )}
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PoolSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton variant="rect" className="w-12 h-12 rounded-card" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-48" />
              <Skeleton variant="text" className="w-24" />
            </div>
          </div>
          <Skeleton variant="rect" className="w-full h-4 rounded-full" />
          <div className="flex justify-between">
            <Skeleton variant="text" className="w-32" />
            <Skeleton variant="text" className="w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ locale }: { locale: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-20 h-20 rounded-2xl bg-background border border-border flex items-center justify-center">
        <Gift className="w-10 h-10 text-muted/30" />
      </div>
      <div>
        <p className="font-semibold text-secondary text-base">No gift pools yet</p>
        <p className="text-sm text-muted mt-1 max-w-xs">
          Start your first group gift from any product page
        </p>
      </div>
      <Link
        href={`/${locale}/search`}
        className="mt-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-6 py-3 rounded-button transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Browse products
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Active', 'Completed', 'Expired', 'Cancelled'] as const;
type Tab = (typeof TABS)[number];

export default function GiftPoolsPage() {
  const locale               = useLocale();
  const [activeTab, setTab]  = useState<Tab>('Active');

  const { data, isLoading, isError, refetch } = useAuthQuery<GiftPoolsResponse>(
    ['gift-pools', 'my'],
    '/gift-pools/my',
  );

  const allPools = data?.pools ?? [];
  const targetStatuses = TAB_STATUSES[activeTab];
  const filtered = allPools.filter((p) => targetStatuses.includes(p.status));

  const tabCount = (tab: Tab) =>
    allPools.filter((p) => TAB_STATUSES[tab].includes(p.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Gift Pools</h1>
          <p className="text-sm text-muted mt-1">Organize group gifts for the people you love</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const count = tabCount(tab);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary'
              }`}
            >
              {tab}
              {count > 0 && (
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-border text-secondary tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && <PoolSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-sm text-error">Failed to load gift pools.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        activeTab === 'Active'
          ? <EmptyState locale={locale} />
          : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Gift className="w-10 h-10 text-muted/30" />
              <p className="text-sm text-muted">No {activeTab.toLowerCase()} pools</p>
            </div>
          )
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((pool) => (
            <PoolCard key={pool.id} pool={pool} onRefetch={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
