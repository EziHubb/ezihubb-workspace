'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Sun, Snowflake, Leaf, CloudRain,
  CheckCircle, Circle, Settings, ChevronDown, ChevronUp,
  Target, TrendingUp, Plus, Trash2, X, Palette,
} from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtNum } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface Campaign {
  id:           string;
  name:         string;
  season:       Season | null;
  isActive:     boolean;
  bannerText:   string;
  ctaLabel:     string;
  ctaHref:      string;
  countdownEnd: string | null;
  gradient:     string;
  primaryColor: string;
  accentColor:  string;
  bgColor:      string;
  startDate:    string | null;
  endDate:      string | null;
  updatedAt:    string;
}

interface CampaignStats {
  activeCampaigns:  number;
  totalCampaigns:   number;
  campaignRevenue:  number;
  avgOrderLift:     number;
}

// ── Season config ─────────────────────────────────────────────────────────────

const SEASON_CFG: Record<Season, { label: string; Icon: React.ElementType; gradient: string }> = {
  spring: { label: 'Spring', Icon: Leaf,      gradient: 'from-[#A8E6CF] to-[#DCEDC1]' },
  summer: { label: 'Summer', Icon: Sun,        gradient: 'from-[#FFD54F] to-[#FF8A65]' },
  autumn: { label: 'Autumn', Icon: CloudRain,  gradient: 'from-[#D7CCC8] to-[#FF8A65]' },
  winter: { label: 'Winter', Icon: Snowflake,  gradient: 'from-[#B3E5FC] to-[#E1F5FE]' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon: Icon, color = 'coral' }: {
  label: string; value: string | number; icon: React.ElementType;
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

function SeasonPill({ season }: { season: Season | null }) {
  if (!season) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/10 text-muted"><Palette className="w-3 h-3" />Custom</span>;
  const cfg = SEASON_CFG[season];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r ${cfg.gradient} text-white`}>
      <cfg.Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Settings accordion ────────────────────────────────────────────────────────

function SettingsAccordion({ campaign, onSave }: {
  campaign: Campaign;
  onSave: (id: string, patch: Partial<Campaign>) => Promise<void>;
}) {
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState({
    name:         campaign.name,
    bannerText:   campaign.bannerText,
    ctaLabel:     campaign.ctaLabel,
    ctaHref:      campaign.ctaHref,
    countdownEnd: campaign.countdownEnd ?? '',
    gradient:     campaign.gradient,
    primaryColor: campaign.primaryColor,
    accentColor:  campaign.accentColor,
    bgColor:      campaign.bgColor,
    startDate:    campaign.startDate?.slice(0, 10) ?? '',
    endDate:      campaign.endDate?.slice(0, 10)   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const { alert } = useDialog();

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(campaign.id, form);
    } catch (err) {
      await alert((err as Error).message || 'Could not save campaign settings.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-border rounded-button px-2 py-1.5 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30 text-secondary';

  return (
    <div className="border-t border-border">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-muted hover:text-secondary transition-colors">
        <Settings className="w-3.5 h-3.5" />Customize
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-muted">Name</span>
            <input value={form.name} onChange={f('name')} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Banner text</span>
              <input value={form.bannerText} onChange={f('bannerText')} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">CTA label</span>
              <input value={form.ctaLabel} onChange={f('ctaLabel')} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">CTA link</span>
              <input value={form.ctaHref} onChange={f('ctaHref')} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Countdown end (ISO)</span>
              <input value={form.countdownEnd} onChange={f('countdownEnd')} placeholder="2026-12-25T00:00:00Z" className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">Start date</span>
              <input type="date" value={form.startDate} onChange={f('startDate')} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">End date</span>
              <input type="date" value={form.endDate} onChange={f('endDate')} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-4">
            {[['primaryColor','Primary'],['accentColor','Accent'],['bgColor','Background']].map(([key,label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-medium text-muted">{label}</span>
                <input type="color" value={(form as any)[key]} onChange={f(key)} className="h-8 w-14 rounded border border-border cursor-pointer" />
              </label>
            ))}
          </div>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-xs font-semibold rounded-button transition-colors">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name:         '',
    season:       '',
    bannerText:   '',
    ctaLabel:     'Shop now',
    ctaHref:      '/products',
    primaryColor: '#E85D3F',
    accentColor:  '#C44A2E',
    bgColor:      '#fff5f3',
    startDate:    '',
    endDate:      '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreate({
        ...form,
        season:    form.season || undefined,
        startDate: form.startDate || undefined,
        endDate:   form.endDate   || undefined,
      });
      onClose();
    } catch {
      setError('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-card border border-border shadow-floating w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-sm">New Campaign</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-muted/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Name *</label>
            <input value={form.name} onChange={f('name')} placeholder="Black Friday Sale" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Season (optional)</label>
            <Select
              size="sm"
              value={form.season}
              onChange={f('season')}
              options={[
                { value: '',       label: '— Custom / No season —' },
                { value: 'spring', label: 'Spring' },
                { value: 'summer', label: 'Summer' },
                { value: 'autumn', label: 'Autumn' },
                { value: 'winter', label: 'Winter' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Banner text</label>
            <input value={form.bannerText} onChange={f('bannerText')} placeholder="🔥 Up to 50% off — limited time!" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">CTA label</label>
              <input value={form.ctaLabel} onChange={f('ctaLabel')} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">CTA link</label>
              <input value={form.ctaHref} onChange={f('ctaHref')} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Start date</label>
              <input type="date" value={form.startDate} onChange={f('startDate')} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">End date</label>
              <input type="date" value={form.endDate} onChange={f('endDate')} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {[['primaryColor','Primary'],['accentColor','Accent'],['bgColor','Background']].map(([key,label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-medium text-muted">{label}</span>
                <input type="color" value={(form as any)[key]} onChange={f(key)} className="h-9 w-16 rounded-lg border border-border cursor-pointer" />
              </label>
            ))}
          </div>

          {/* Live preview */}
          <div className="rounded-lg h-10 flex items-center justify-center gap-3 text-white text-xs font-semibold"
            style={{ background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})` }}>
            <span>{form.bannerText || 'Banner preview'}</span>
            {form.ctaLabel && <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-bold">{form.ctaLabel}</span>}
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-secondary border border-border rounded-button hover:bg-muted/5 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold rounded-button transition-colors">
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onActivate, onDeactivate, onSaveSettings, onDelete }: {
  campaign:       Campaign;
  onActivate:     (id: string) => Promise<void>;
  onDeactivate:   (id: string) => Promise<void>;
  onSaveSettings: (id: string, patch: Partial<Campaign>) => Promise<void>;
  onDelete:       (id: string) => Promise<void>;
}) {
  const [toggling, setToggling]   = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { alert } = useDialog();

  const handleToggle = async () => {
    setToggling(true);
    try {
      campaign.isActive ? await onDeactivate(campaign.id) : await onActivate(campaign.id);
    } catch (err) {
      await alert((err as Error).message || `Could not ${campaign.isActive ? 'deactivate' : 'activate'} this campaign.`, { variant: 'error' });
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(campaign.id);
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this campaign.', { variant: 'error' });
    } finally {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  const stripGradient = campaign.season && SEASON_CFG[campaign.season]
    ? `bg-gradient-to-r ${SEASON_CFG[campaign.season].gradient}`
    : '';

  return (
    <div className={['bg-surface border rounded-card overflow-hidden transition-all',
      campaign.isActive ? 'border-primary shadow-md ring-1 ring-primary/20' : 'border-border shadow-card',
    ].join(' ')}>
      {/* Color strip */}
      <div className={['h-2', stripGradient].join(' ')}
        style={!stripGradient ? { background: `linear-gradient(90deg,${campaign.primaryColor},${campaign.accentColor})` } : undefined} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeasonPill season={campaign.season} />
              {campaign.isActive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live
                </span>
              )}
            </div>
            <h3 className="font-semibold text-secondary text-sm truncate">{campaign.name}</h3>
            <p className="text-xs text-muted line-clamp-1">{campaign.bannerText || '—'}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={handleToggle} disabled={toggling}
              title={campaign.isActive ? 'Deactivate' : 'Activate'}
              className={['p-1.5 rounded-lg transition-colors',
                campaign.isActive ? 'text-green-600 hover:bg-green-50' : 'text-muted hover:bg-primary/5 hover:text-primary',
                toggling && 'opacity-50 cursor-not-allowed',
              ].join(' ')}>
              {campaign.isActive ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </button>
            {!confirmDel ? (
              <button type="button" onClick={() => setConfirmDel(true)}
                className="p-1.5 rounded-lg text-muted hover:bg-error/8 hover:text-error transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="px-2 py-1 rounded text-[10px] font-bold bg-error text-white hover:bg-error/90 disabled:opacity-50 transition-colors">
                  {deleting ? '…' : 'Yes'}
                </button>
                <button type="button" onClick={() => setConfirmDel(false)}
                  className="px-2 py-1 rounded text-[10px] font-bold border border-border text-muted hover:bg-muted/5 transition-colors">
                  No
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted">
          {campaign.startDate && (
            <span>{new Date(campaign.startDate).toLocaleDateString()} – {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : '∞'}</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            {[campaign.primaryColor, campaign.accentColor, campaign.bgColor].map((hex, i) => (
              <div key={i} className="w-5 h-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: hex }} title={hex} />
            ))}
          </div>
          <span className="text-[10px] text-muted font-mono truncate">{campaign.gradient || 'custom colors'}</span>
        </div>
      </div>

      <SettingsAccordion campaign={campaign} onSave={onSaveSettings} />
    </div>
  );
}

// ── Season switcher ───────────────────────────────────────────────────────────

function SeasonSwitcher({ active, onChange }: { active: Season | 'all'; onChange: (s: Season | 'all') => void }) {
  const tabs: { value: Season | 'all'; label: string; Icon?: React.ElementType }[] = [
    { value: 'all', label: 'All' },
    { value: 'spring', label: 'Spring', Icon: Leaf },
    { value: 'summer', label: 'Summer', Icon: Sun },
    { value: 'autumn', label: 'Autumn', Icon: CloudRain },
    { value: 'winter', label: 'Winter', Icon: Snowflake },
  ];
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/10 rounded-lg w-fit">
      {tabs.map(({ value, label, Icon }) => (
        <button key={value} type="button" onClick={() => onChange(value)}
          className={['flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
            active === value ? 'bg-white text-secondary shadow-sm' : 'text-muted hover:text-secondary',
          ].join(' ')}>
          {Icon && <Icon className="w-3.5 h-3.5" />}{label}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [season,      setSeason]      = useState<Season | 'all'>('all');
  const [showCreate,  setShowCreate]  = useState(false);

  const statsQuery = useQuery<CampaignStats>({
    queryKey: ['campaign-stats'],
    queryFn:  () => api.get<CampaignStats>(API_ROUTES.ADMIN.CAMPAIGN_STATS),
    staleTime: 60_000,
  });

  const listQuery = useQuery<Campaign[]>({
    queryKey: ['admin-campaigns', season],
    queryFn:  () => api.get<Campaign[]>(API_ROUTES.ADMIN.CAMPAIGNS,
      season !== 'all' ? { params: { season } } : undefined),
  });

  const stats     = statsQuery.data;
  const campaigns = listQuery.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    qc.invalidateQueries({ queryKey: ['campaign-stats'] });
  };

  const handleCreate       = async (data: any) => { await api.post(API_ROUTES.ADMIN.CAMPAIGNS, data); invalidate(); };
  const handleActivate     = async (id: string) => { await api.post(API_ROUTES.ADMIN.CAMPAIGN_ACTIVATE(id), {}); invalidate(); };
  const handleDeactivate   = async (id: string) => { await api.post(API_ROUTES.ADMIN.CAMPAIGN_DEACTIVATE(id), {}); invalidate(); };
  const handleSaveSettings = async (id: string, patch: Partial<Campaign>) => { await api.patch(API_ROUTES.ADMIN.CAMPAIGN(id), patch); invalidate(); };
  const handleDelete       = async (id: string) => { await api.delete(API_ROUTES.ADMIN.CAMPAIGN(id)); invalidate(); };

  const activeCampaign = campaigns.find((c) => c.isActive);

  return (
    <>
      <AdminPageHeader
        title="Campaigns"
        subtitle="Seasonal banners, flash deal windows, and campaign settings"
        actions={
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        }
        queryKey={['admin-campaigns']}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <MiniStat label="Active Campaigns"  value={stats?.activeCampaigns ?? '—'} icon={Megaphone}   color="coral"  />
        <MiniStat label="Total Campaigns"    value={stats?.totalCampaigns  ?? '—'} icon={TrendingUp}   color="green"  />
        <MiniStat label="Avg Order Lift"     value={stats ? `+${stats.avgOrderLift}%` : '—'} icon={Target} color="blue" />
      </div>

      {/* Filter + count */}
      <div className="flex items-center justify-between mb-6">
        <SeasonSwitcher active={season} onChange={setSeason} />
        <p className="text-xs text-muted">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Cards */}
      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-52 rounded-card bg-muted/10 animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Megaphone className="w-10 h-10 text-muted/30" />
          <p className="font-semibold text-secondary">No campaigns</p>
          <p className="text-sm text-muted">Click "New Campaign" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c}
              onActivate={handleActivate} onDeactivate={handleDeactivate}
              onSaveSettings={handleSaveSettings} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Live banner preview */}
      {activeCampaign && (
        <div className="mt-8 p-5 border border-border rounded-card bg-surface space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h4 className="font-semibold text-sm text-secondary">Live banner preview — client sees this</h4>
          </div>
          <div className="h-10 rounded-lg flex items-center justify-center gap-3 text-white font-semibold text-sm"
            style={{ background: `linear-gradient(90deg, ${activeCampaign.primaryColor}, ${activeCampaign.accentColor})` }}>
            <span className="text-xs">{activeCampaign.bannerText}</span>
            {activeCampaign.ctaLabel && (
              <span className="px-3 py-1 rounded-full bg-white/25 border border-white/30 text-[10px] font-bold">
                {activeCampaign.ctaLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>Primary: <code className="font-mono">{activeCampaign.primaryColor}</code></span>
            <span>Accent: <code className="font-mono">{activeCampaign.accentColor}</code></span>
            <span>BG: <code className="font-mono">{activeCampaign.bgColor}</code></span>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </>
  );
}
