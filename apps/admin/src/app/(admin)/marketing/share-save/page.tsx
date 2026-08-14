'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, TrendingUp, Users, Wallet, LogOut } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';

interface ShareSaveStatus {
  enabled:    boolean;
  joinedAt:   string | null;
  shopUrl:    string;
  refundRate: number;
  stats: {
    clicks30d:      number;
    conversions30d: number;
    refunded30d:    number;
  };
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-secondary tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function ShareSavePage() {
  const qc = useQueryClient();
  const { confirm } = useDialog();

  const { data, isLoading } = useQuery<ShareSaveStatus>({
    queryKey: ['share-save-status'],
    queryFn:  () => api.get<ShareSaveStatus>(API_ROUTES.ADMIN.SHARE_SAVE),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['share-save-status'] });

  const handleJoin = async () => {
    await api.post(API_ROUTES.ADMIN.SHARE_SAVE_JOIN, {});
    invalidate();
  };

  const handleLeave = async () => {
    if (!await confirm('Leave Share & Save? Buyers will no longer earn credit for sharing your shop.', { confirmLabel: 'Leave', destructive: true })) return;
    await api.post(API_ROUTES.ADMIN.SHARE_SAVE_LEAVE, {});
    invalidate();
  };

  if (isLoading || !data) {
    return (
      <>
        <AdminPageHeader title="Share & Save" subtitle="Loading…" />
        <div className="h-40 bg-surface rounded-card border border-border animate-pulse" />
      </>
    );
  }

  const refundPct = Math.round(data.refundRate * 100);

  if (!data.enabled) {
    return (
      <>
        <AdminPageHeader title="Share & Save" subtitle="Reward buyers for sharing your shop" />

        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-card border border-border p-8 mb-6 text-center">
          <Gift className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-secondary mb-2">Turn shoppers into promoters</h2>
          <p className="text-sm text-muted max-w-lg mx-auto mb-5">
            Once you join, every logged-in buyer sees a "Share & Save" widget on your shop page with
            their own personal link. When someone new buys through it within 30 days, the buyer who
            shared it gets an instant {refundPct}% credit — funded by you, paid for by more sales.
          </p>
          <button
            type="button"
            onClick={handleJoin}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors"
          >
            Join Share & Save
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { step: '1', title: 'Buyer shares', desc: 'A logged-in buyer copies their own personal link from your shop page and shares it.' },
            { step: '2', title: 'Someone buys', desc: 'A new order is placed through that link within 30 days.' },
            { step: '3', title: 'Instant credit', desc: `The sharer gets ${refundPct}% of the order back — you fund it, they keep sharing.` },
          ].map((s) => (
            <div key={s.step} className="bg-surface rounded-card border border-border p-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-2">{s.step}</div>
              <p className="text-sm font-semibold text-secondary mb-1">{s.title}</p>
              <p className="text-xs text-muted">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Important things to note</p>
          <ul className="text-xs text-muted space-y-1.5 list-disc pl-4">
            <li>Credit is instant, not held for a delay period.</li>
            <li>Attribution only counts traffic coming from outside the platform through the tracked link.</li>
            <li>If a buyer also came through an Offsite Ads click, whichever link was clicked most recently wins — never both.</li>
            <li>You can leave Share & Save at any time; existing credits already issued are not reversed.</li>
          </ul>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Share & Save"
        subtitle="You're in — buyers earn credit for sharing your shop"
        actions={
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-red-300 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </button>
        }
      />

      <div className="bg-surface rounded-card border border-border shadow-card p-5 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Where buyers get their link</p>
        <p className="text-sm text-secondary">
          Every logged-in buyer sees a "Share & Save" widget with their own personal link right on{' '}
          <a href={data.shopUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
            your shop page
          </a>. There's no single shared link — each buyer's is unique to them, so credit always goes to whoever actually shared it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Link clicks (30d)" value={data.stats.clicks30d} icon={TrendingUp} />
        <StatCard label="Orders attributed (30d)" value={data.stats.conversions30d} icon={Users} />
        <StatCard label="Credit issued (30d)" value={fmtAmount(data.stats.refunded30d)} icon={Wallet} />
      </div>
    </>
  );
}
