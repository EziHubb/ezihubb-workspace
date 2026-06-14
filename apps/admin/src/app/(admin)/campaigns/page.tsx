'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Sun, Snowflake, Leaf, CloudRain,
  CheckCircle, Circle, Settings, ChevronDown, ChevronUp,
  Zap, Users, Target, TrendingUp,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtNum } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface Campaign {
  id:           string;
  name:         string;
  season:       Season;
  isActive:     boolean;
  bannerText:   string;
  ctaLabel:     string;
  ctaHref:      string;
  countdownEnd: string | null;
  gradient:     string;
  primaryColor: string;
  accentColor:  string;
  bgColor:      string;
  flashDeals:   number;
  startDate:    string | null;
  endDate:      string | null;
  updatedAt:    string;
}

interface CampaignStats {
  activeCampaigns:  number;
  totalFlashDeals:  number;
  campaignRevenue:  number;
  avgOrderLift:     number;
}

// ── Season config ─────────────────────────────────────────────────────────────

const SEASON_CFG: Record<Season, {
  label:    string;
  Icon:     React.ElementType;
  gradient: string;
  primary:  string;
  accent:   string;
  bg:       string;
}> = {
  spring: {
    label:    'Spring',
    Icon:     Leaf,
    gradient: 'from-[#A8E6CF] to-[#DCEDC1]',
    primary:  '#4CAF50',
    accent:   '#8BC34A',
    bg:       '#F1F8E9',
  },
  summer: {
    label:    'Summer',
    Icon:     Sun,
    gradient: 'from-[#FFD54F] to-[#FF8A65]',
    primary:  '#FF6F00',
    accent:   '#FFC107',
    bg:       '#FFF8E1',
  },
  autumn: {
    label:    'Autumn',
    Icon:     CloudRain,
    gradient: 'from-[#D7CCC8] to-[#FF8A65]',
    primary:  '#E64A19',
    accent:   '#FF7043',
    bg:       '#FBE9E7',
  },
  winter: {
    label:    'Winter',
    Icon:     Snowflake,
    gradient: 'from-[#B3E5FC] to-[#E1F5FE]',
    primary:  '#0288D1',
    accent:   '#29B6F6',
    bg:       '#E3F2FD',
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, icon: Icon, color = 'coral',
}: {
  label: string; value: string | number;
  icon: React.ElementType;
  color?: 'coral' | 'blue' | 'green' | 'amber';
}) {
  const c = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
    amber: { bg: 'bg-amber-50',   text: 'text-amber-600' },
  }[color];
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-secondary tabular-nums leading-tight">
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SeasonPill({ season }: { season: Season }) {
  const cfg = SEASON_CFG[season];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r ${cfg.gradient} text-white`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Settings accordion ────────────────────────────────────────────────────────

interface SettingsAccordionProps {
  campaign:   Campaign;
  onSave:     (id: string, patch: Partial<Campaign>) => Promise<void>;
}

function SettingsAccordion({ campaign, onSave }: SettingsAccordionProps) {
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState({
    bannerText:   campaign.bannerText,
    ctaLabel:     campaign.ctaLabel,
    ctaHref:      campaign.ctaHref,
    countdownEnd: campaign.countdownEnd ?? '',
    gradient:     campaign.gradient,
    primaryColor: campaign.primaryColor,
    accentColor:  campaign.accentColor,
    bgColor:      campaign.bgColor,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(campaign.id, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-muted hover:text-secondary transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        Customize
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Banner text</span>
              <input
                value={form.bannerText}
                onChange={(e) => setForm((f) => ({ ...f, bannerText: e.target.value }))}
                className="w-full border border-border rounded-button px-2 py-1.5 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">CTA label</span>
              <input
                value={form.ctaLabel}
                onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                className="w-full border border-border rounded-button px-2 py-1.5 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">CTA link</span>
              <input
                value={form.ctaHref}
                onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
                className="w-full border border-border rounded-button px-2 py-1.5 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Countdown end (ISO)</span>
              <input
                value={form.countdownEnd}
                onChange={(e) => setForm((f) => ({ ...f, countdownEnd: e.target.value }))}
                placeholder="2026-12-25T00:00:00Z"
                className="w-full border border-border rounded-button px-2 py-1.5 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Primary</span>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-8 w-14 rounded border border-border cursor-pointer"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Accent</span>
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="h-8 w-14 rounded border border-border cursor-pointer"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Background</span>
              <input
                type="color"
                value={form.bgColor}
                onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                className="h-8 w-14 rounded border border-border cursor-pointer"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-xs font-semibold rounded-button transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign:         Campaign;
  onActivate:       (id: string) => Promise<void>;
  onDeactivate:     (id: string) => Promise<void>;
  onSaveSettings:   (id: string, patch: Partial<Campaign>) => Promise<void>;
}

function CampaignCard({ campaign, onActivate, onDeactivate, onSaveSettings }: CampaignCardProps) {
  const cfg = SEASON_CFG[campaign.season];
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (campaign.isActive) {
        await onDeactivate(campaign.id);
      } else {
        await onActivate(campaign.id);
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={[
      'bg-surface border rounded-card overflow-hidden transition-all',
      campaign.isActive ? 'border-primary shadow-md ring-1 ring-primary/20' : 'border-border shadow-card',
    ].join(' ')}>
      {/* Season color strip */}
      <div className={`h-2 bg-gradient-to-r ${cfg.gradient}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SeasonPill season={campaign.season} />
              {campaign.isActive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <h3 className="font-semibold text-secondary text-sm">{campaign.name}</h3>
            <p className="text-xs text-muted line-clamp-1">{campaign.bannerText || '—'}</p>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            title={campaign.isActive ? 'Deactivate campaign' : 'Activate campaign'}
            className={[
              'shrink-0 p-1.5 rounded-lg transition-colors',
              campaign.isActive
                ? 'text-green-600 hover:bg-green-50'
                : 'text-muted hover:bg-primary/5 hover:text-primary',
              toggling && 'opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            {campaign.isActive ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        </div>

        {/* Meta row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {campaign.flashDeals} flash deals
          </span>
          {campaign.startDate && (
            <span>
              {new Date(campaign.startDate).toLocaleDateString()} –{' '}
              {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '∞'}
            </span>
          )}
        </div>

        {/* Color tokens preview */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            {[campaign.primaryColor, campaign.accentColor, campaign.bgColor].map((hex, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted font-mono truncate">{campaign.gradient || 'no gradient'}</span>
        </div>
      </div>

      <SettingsAccordion campaign={campaign} onSave={onSaveSettings} />
    </div>
  );
}

// ── Season switcher ───────────────────────────────────────────────────────────

function SeasonSwitcher({
  active, onChange,
}: { active: Season | 'all'; onChange: (s: Season | 'all') => void }) {
  const tabs: { value: Season | 'all'; label: string; Icon?: React.ElementType }[] = [
    { value: 'all',    label: 'All' },
    { value: 'spring', label: 'Spring',  Icon: Leaf      },
    { value: 'summer', label: 'Summer',  Icon: Sun       },
    { value: 'autumn', label: 'Autumn',  Icon: CloudRain },
    { value: 'winter', label: 'Winter',  Icon: Snowflake },
  ];
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/10 rounded-lg w-fit">
      {tabs.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
            active === value
              ? 'bg-white text-secondary shadow-sm'
              : 'text-muted hover:text-secondary',
          ].join(' ')}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [season, setSeason] = useState<Season | 'all'>('all');

  const statsQuery = useQuery<CampaignStats>({
    queryKey: ['campaign-stats'],
    queryFn:  () => api.get<CampaignStats>(API_ROUTES.ADMIN.CAMPAIGN_STATS),
    staleTime: 60_000,
  });

  const listQuery = useQuery<Campaign[]>({
    queryKey: ['admin-campaigns', season],
    queryFn:  () => {
      const params: Record<string, string> = {};
      if (season !== 'all') params['season'] = season;
      return api.get<Campaign[]>(API_ROUTES.ADMIN.CAMPAIGNS, { params });
    },
  });

  const stats     = statsQuery.data;
  const campaigns = listQuery.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    qc.invalidateQueries({ queryKey: ['campaign-stats'] });
  };

  const handleActivate = async (id: string) => {
    await api.post(API_ROUTES.ADMIN.CAMPAIGN_ACTIVATE(id), {});
    invalidate();
  };

  const handleDeactivate = async (id: string) => {
    await api.post(API_ROUTES.ADMIN.CAMPAIGN_DEACTIVATE(id), {});
    invalidate();
  };

  const handleSaveSettings = async (id: string, patch: Partial<Campaign>) => {
    await api.patch(API_ROUTES.ADMIN.CAMPAIGN(id), patch);
    invalidate();
  };

  return (
    <>
      <AdminPageHeader
        title="Campaigns"
        subtitle="Seasonal banners, flash deal windows, and campaign token settings"
        actions={null}
        queryKey={['admin-campaigns']}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Active Campaigns"  value={stats?.activeCampaigns ?? '—'} icon={Megaphone}  color="coral"  />
        <MiniStat label="Total Flash Deals"  value={stats?.totalFlashDeals ?? '—'} icon={Zap}        color="amber"  />
        <MiniStat label="Campaign Revenue"   value={stats ? fmtAmount(stats.campaignRevenue) : '—'} icon={TrendingUp} color="green" />
        <MiniStat label="Avg Order Lift"     value={stats ? `+${stats.avgOrderLift}%` : '—'} icon={Target}    color="blue"   />
      </div>

      {/* Season switcher */}
      <div className="flex items-center justify-between mb-6">
        <SeasonSwitcher active={season} onChange={setSeason} />
        <p className="text-xs text-muted">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Cards grid */}
      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 rounded-card bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Megaphone className="w-10 h-10 text-muted/30" />
          <p className="font-semibold text-secondary">No campaigns</p>
          <p className="text-sm text-muted">Campaigns are created via the API or seeded automatically per season.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onSaveSettings={handleSaveSettings}
            />
          ))}
        </div>
      )}

      {/* Active campaign preview */}
      {campaigns.some((c) => c.isActive) && (() => {
        const active = campaigns.find((c) => c.isActive)!;
        return (
          <div className="mt-8 p-5 border border-border rounded-card bg-surface space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h4 className="font-semibold text-sm text-secondary">Live banner preview</h4>
            </div>
            <div
              className="h-14 rounded-lg flex items-center justify-center gap-3 text-white font-semibold text-sm"
              style={{ background: `linear-gradient(90deg, ${active.primaryColor}, ${active.accentColor})` }}
            >
              <span>{active.bannerText}</span>
              {active.ctaLabel && (
                <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-bold">
                  {active.ctaLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>Primary: <code className="font-mono">{active.primaryColor}</code></span>
              <span>Accent: <code className="font-mono">{active.accentColor}</code></span>
              <span>BG: <code className="font-mono">{active.bgColor}</code></span>
            </div>
          </div>
        );
      })()}
    </>
  );
}
