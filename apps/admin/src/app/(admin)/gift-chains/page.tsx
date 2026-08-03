'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  TrendingUp,
  Users,
  Zap,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Flag,
  X,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate, fmtAmount, fmtNum, safeArr } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChainStage = 'SENT' | 'OPENED' | 'FORWARDED';
type ChainStatus = 'ACTIVE' | 'CLOSED' | 'FLAGGED';

interface ChainLinkRow {
  id:             string;
  stage:          ChainStage;
  senderEmail:    string;
  recipientEmail: string;
  sentAt:         string;
  forwardedAt:    string | null;
}

interface GiftChainRow {
  id:            string;
  initiatorEmail: string;
  productName:   string;
  productPrice:  number;
  linkCount:     number;
  gmv:           number;
  startedAt:     string;
  status:        ChainStatus;
  links:         ChainLinkRow[];
}

interface GiftChainListResponse {
  data:       GiftChainRow[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

interface GiftChainStats {
  activeChains:   number;
  avgChainLength: number;
  totalGmv:       number;
  longestChain:   number;
  payForwardRate: number;
  avgDaysToAction: number;
  topGiftedProducts: { name: string; count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const masked = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}`;
  return `${masked}@${domain}`;
}

const STATUS_STYLES: Record<ChainStatus, string> = {
  ACTIVE:  'bg-green-50 text-green-700 border-green-200',
  CLOSED:  'bg-muted/10 text-muted border-border',
  FLAGGED: 'bg-red-50 text-red-700 border-red-200',
};

const STAGE_STYLES: Record<ChainStage, string> = {
  SENT:      'bg-muted/10 text-muted border-border',
  OPENED:    'bg-blue-50 text-blue-700 border-blue-200',
  FORWARDED: 'bg-green-50 text-green-700 border-green-200',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-secondary tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function ChainRowItem({
  chain,
  onClose,
  onFlag,
}: {
  chain: GiftChainRow;
  onClose: (id: string) => void;
  onFlag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-border hover:bg-background/60 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-secondary tabular-nums">
          #{chain.id.slice(-6).toUpperCase()}
        </td>
        <td className="px-4 py-3 text-sm text-muted">{maskEmail(chain.initiatorEmail)}</td>
        <td className="px-4 py-3 text-sm text-secondary line-clamp-1 max-w-[160px]">{chain.productName}</td>
        <td className="px-4 py-3 text-sm tabular-nums text-secondary font-medium">{chain.linkCount}</td>
        <td className="px-4 py-3 text-sm tabular-nums text-secondary">{fmtAmount(chain.gmv)}</td>
        <td className="px-4 py-3 text-sm text-muted">{fmtDate(chain.startedAt)}</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[chain.status]}`}>
            {chain.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-button border border-primary/20 hover:border-primary/40"
            >
              View chain
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-button hover:bg-background border border-transparent hover:border-border transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-muted" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-surface border border-border rounded-card shadow-card min-w-[140px] py-1">
                  <button
                    type="button"
                    onClick={() => { onFlag(chain.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:bg-background transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-500" />
                    Flag for review
                  </button>
                  <button
                    type="button"
                    onClick={() => { onClose(chain.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-background transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Close chain
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-0">
            <div className="bg-background/40 border-t border-border rounded-b-lg mb-2 overflow-hidden">
              {chain.links.length === 0 ? (
                <p className="text-sm text-muted px-4 py-4">No link history available for this chain.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">Sender</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">Recipient</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">Sent</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.links.map((link, idx) => (
                      <tr key={link.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-2 text-xs text-secondary">{maskEmail(link.senderEmail)}</td>
                        <td className="px-4 py-2 text-xs text-secondary">{maskEmail(link.recipientEmail)}</td>
                        <td className="px-4 py-2 text-xs text-muted">{chain.productName}</td>
                        <td className="px-4 py-2 text-xs text-muted">{fmtDate(link.sentAt)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STAGE_STYLES[link.stage]}`}>
                            {link.stage}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const MOCK_STATS: GiftChainStats = {
  activeChains:      0,
  avgChainLength:    0,
  totalGmv:          0,
  longestChain:      0,
  payForwardRate:    0,
  avgDaysToAction:   0,
  topGiftedProducts: [],
};

export default function GiftChainsAdminPage() {
  const qc   = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<GiftChainStats>({
    queryKey: ['admin-gift-chain-stats'],
    queryFn:  () => api.get<GiftChainStats>(API_ROUTES.ADMIN.GIFT_CHAINS_STATS).catch(() => MOCK_STATS),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery<GiftChainListResponse>({
    queryKey: ['admin-gift-chains', page],
    queryFn:  () => api.get<GiftChainListResponse>(`${API_ROUTES.ADMIN.GIFT_CHAINS}?page=${page}&limit=20`),
    staleTime: 30_000,
  });

  const s = stats ?? MOCK_STATS;

  const handleClose = async (id: string) => {
    await api.delete(API_ROUTES.ADMIN.GIFT_CHAIN(id)).catch(() => null);
    qc.invalidateQueries({ queryKey: ['admin-gift-chains'] });
    qc.invalidateQueries({ queryKey: ['admin-gift-chain-stats'] });
  };

  const handleFlag = async (id: string) => {
    await api.patch(API_ROUTES.ADMIN.GIFT_CHAIN(id), { status: 'FLAGGED' }).catch(() => null);
    qc.invalidateQueries({ queryKey: ['admin-gift-chains'] });
  };

  const chains = safeArr(data?.data);

  return (
    <>
      <AdminPageHeader
        title="Gift Chains"
        subtitle="Track viral gift chains, pay-forward metrics, and platform GMV"
        queryKey={['admin-gift-chains']}
      />

      {/* Platform stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Link2}
          label="Active chains"
          value={fmtNum(s.activeChains)}
          sub="Currently in motion"
        />
        <StatCard
          icon={ChevronRight}
          label="Avg chain length"
          value={s.avgChainLength.toFixed(1)}
          sub="Links per chain"
        />
        <StatCard
          icon={TrendingUp}
          label="Total GMV"
          value={fmtAmount(s.totalGmv)}
          sub="All time"
        />
        <StatCard
          icon={Zap}
          label="Longest chain"
          value={fmtNum(s.longestChain)}
          sub="Links"
        />
      </div>

      {/* Viral metrics */}
      <div className="bg-surface border border-border rounded-card p-5 mb-8">
        <h2 className="font-semibold text-secondary mb-4">Viral metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Pay-forward rate
            </p>
            <p className="text-2xl font-bold text-secondary tabular-nums">{s.payForwardRate.toFixed(1)}%</p>
            <p className="text-xs text-muted mt-0.5">Of recipients who forwarded</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Avg days to action
            </p>
            <p className="text-2xl font-bold text-secondary tabular-nums">{s.avgDaysToAction.toFixed(1)}</p>
            <p className="text-xs text-muted mt-0.5">From receipt to forward</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Top gifted products
            </p>
            {s.topGiftedProducts.length === 0 ? (
              <p className="text-sm text-muted">No data yet</p>
            ) : (
              <ol className="space-y-1">
                {s.topGiftedProducts.slice(0, 5).map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between text-sm">
                    <span className="text-secondary truncate max-w-[160px]">
                      <span className="text-muted mr-1.5">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="text-muted tabular-nums text-xs">{fmtNum(p.count)} chains</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary">Longest chains this month</h2>
          <p className="text-xs text-muted mt-0.5">Ranked by number of links in the chain</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Chain ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Initiator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Links</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">GMV</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-border/40 rounded animate-pulse w-full max-w-[100px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : chains.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Link2 className="w-10 h-10 text-border mx-auto mb-3" />
                    <p className="text-sm font-medium text-secondary">No gift chains yet</p>
                    <p className="text-xs text-muted mt-1">Gift chains will appear here once buyers start gifting</p>
                  </td>
                </tr>
              ) : (
                chains.map((chain) => (
                  <ChainRowItem
                    key={chain.id}
                    chain={chain}
                    onClose={handleClose}
                    onFlag={handleFlag}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted">
              Page {data?.page} of {data?.totalPages} — {fmtNum(data?.total ?? 0)} chains
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronDown className="w-3 h-3 rotate-90" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Next
                <ChevronDown className="w-3 h-3 -rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
