'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Truck, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@ezihubb/ui';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../../../contexts/DialogContext';
import { ReloadButton } from '../../../../components/ui/ReloadButton';
import { ProcessingProfileModal } from '../../../../components/shipping/delivery/ProcessingProfileModal';
import { DeliveryProfileModal } from '../../../../components/shipping/delivery/DeliveryProfileModal';
import { OrderProcessingScheduleModal } from '../../../../components/shipping/delivery/OrderProcessingScheduleModal';
import type { ProcessingProfile, ShippingProfile } from '../../../../components/shipping/delivery/types';

const PROCESSING_PROFILES_KEY = ['delivery-processing-profiles'];
const SHIPPING_PROFILES_KEY   = ['delivery-shipping-profiles'];
const SCHEDULE_KEY            = ['delivery-processing-schedule'];
const UPGRADES_KEY            = ['delivery-upgrades-enabled'];

type Tab = 'profiles' | 'guarantee' | 'upgrades';

const TYPE_LABEL: Record<ProcessingProfile['type'], string> = {
  MADE_TO_ORDER: 'Made to order',
  READY_TO_SHIP: 'Ready to dispatch',
};

// ── Order processing schedule card ────────────────────────────────────────────

function ProcessingScheduleCard() {
  const { data, isLoading } = useQuery<{ processesOnSaturday: boolean; processesOnSunday: boolean }>({
    queryKey: SCHEDULE_KEY,
    queryFn:  () => api.get(API_ROUTES.ADMIN.SHIPPING_PROCESSING_SCHEDULE),
  });
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const summary = (() => {
    if (!data) return 'Monday–Friday';
    const parts = ['Monday–Friday'];
    if (data.processesOnSaturday) parts.push('Saturday');
    if (data.processesOnSunday)   parts.push('Sunday');
    return parts.join(', ');
  })();

  return (
    <div>
      <h3 className="font-semibold text-secondary text-lg mb-1">Order processing schedule</h3>
      <p className="text-sm text-muted mb-3 max-w-2xl">
        Let us know the days of the week you prepare, package, or dispatch orders. This can help improve the
        accuracy of buyers' delivery dates and your dispatch-by dates.
      </p>
      <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3.5 bg-background">
        {isLoading ? (
          <div className="h-4 w-40 bg-muted/10 rounded animate-pulse" />
        ) : (
          <span className="text-sm font-semibold text-secondary">{summary}</span>
        )}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {showModal && data && (
        <OrderProcessingScheduleModal
          processesOnSaturday={data.processesOnSaturday}
          processesOnSunday={data.processesOnSunday}
          onClose={() => setShowModal(false)}
          onSaved={(next) => {
            qc.setQueryData(SCHEDULE_KEY, next);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Processing profiles section ───────────────────────────────────────────────

function ProcessingProfilesSection() {
  const qc = useQueryClient();
  const { confirm, alert } = useDialog();
  const { data: profiles = [], isLoading } = useQuery<ProcessingProfile[]>({
    queryKey: PROCESSING_PROFILES_KEY,
    queryFn:  () => api.get(API_ROUTES.ADMIN.SHIPPING_PROCESSING_PROFILES),
  });
  const [modalProfile, setModalProfile] = useState<ProcessingProfile | null | 'new'>(null);

  const handleDelete = async (p: ProcessingProfile) => {
    if (!await confirm(`Delete "${TYPE_LABEL[p.type]} (${p.minDays}-${p.maxDays} days)"?`, { confirmLabel: 'Delete', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.SHIPPING_PROCESSING_PROFILE(p.id));
      qc.invalidateQueries({ queryKey: PROCESSING_PROFILES_KEY });
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this profile.', { variant: 'error' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-secondary text-lg">Your processing profiles</h3>
        <Button variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalProfile('new')}>
          Create new
        </Button>
      </div>
      <p className="text-sm text-muted mb-3 max-w-2xl">
        Add, edit, or apply processing profiles to listings in bulk — assign one to a listing in Product Editor → Pricing &amp; Shipping.
      </p>

      {isLoading && <div className="h-16 bg-muted/5 rounded-lg animate-pulse" />}

      {!isLoading && profiles.length === 0 && (
        <p className="text-sm text-muted border border-dashed border-border rounded-lg px-4 py-6 text-center">
          No processing profiles yet.
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3.5 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary truncate">
                  {TYPE_LABEL[p.type]} ({p.minDays}-{p.maxDays} days)
                </p>
                {p.storeId === null && <p className="text-xs text-muted">Platform default</p>}
              </div>
            </div>
            {/* Platform-default profiles (storeId: null) are read-only for sellers —
                the backend rejects edits/deletes on them regardless, so hide both
                actions rather than let the seller fill out a form that always 403s. */}
            {p.storeId !== null && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setModalProfile(p)} className="p-2 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(p)} className="p-2 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalProfile !== null && (
        <ProcessingProfileModal
          profile={modalProfile === 'new' ? null : modalProfile}
          onClose={() => setModalProfile(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: PROCESSING_PROFILES_KEY });
            setModalProfile(null);
          }}
        />
      )}
    </div>
  );
}

// ── Delivery (shipping) profiles section ──────────────────────────────────────

function DeliveryProfilesSection() {
  const qc = useQueryClient();
  const { confirm, alert } = useDialog();
  const { data: profiles = [], isLoading } = useQuery<ShippingProfile[]>({
    queryKey: SHIPPING_PROFILES_KEY,
    queryFn:  () => api.get(API_ROUTES.ADMIN.SHIPPING_PROFILES),
  });
  const [modalProfile, setModalProfile] = useState<ShippingProfile | null | 'new'>(null);

  const handleDelete = async (p: ShippingProfile) => {
    if (!await confirm(`Delete "${p.name}"?`, { confirmLabel: 'Delete', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.SHIPPING_PROFILE(p.id));
      qc.invalidateQueries({ queryKey: SHIPPING_PROFILES_KEY });
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this profile.', { variant: 'error' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-secondary text-lg">Delivery profiles</h3>
        <Button variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalProfile('new')}>
          Create new
        </Button>
      </div>
      <p className="text-sm text-muted mb-3 max-w-2xl">
        Delivery profiles can be used for multiple listings with similar postage costs — assign one to a listing in Product Editor → Pricing &amp; Shipping.
      </p>

      {isLoading && <div className="h-16 bg-muted/5 rounded-lg animate-pulse" />}

      {!isLoading && profiles.length === 0 && (
        <p className="text-sm text-muted border border-dashed border-border rounded-lg px-4 py-6 text-center">
          No delivery profiles yet.
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3.5 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary truncate">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.activeListings} active listing{p.activeListings !== 1 ? 's' : ''} · {p.methods.length} destination{p.methods.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {/* Platform-default profiles (storeId: null) are read-only for sellers —
                the backend rejects edits/deletes on them regardless. */}
            {p.storeId !== null && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setModalProfile(p)} className="p-2 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {p.activeListings === 0 && (
                  <button type="button" onClick={() => handleDelete(p)} className="p-2 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalProfile !== null && (
        <DeliveryProfileModal
          profile={modalProfile === 'new' ? null : modalProfile}
          onClose={() => setModalProfile(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: SHIPPING_PROFILES_KEY });
            setModalProfile(null);
          }}
        />
      )}
    </div>
  );
}

// ── Delivery guarantee tab ────────────────────────────────────────────────────
// Informational only — a real "ship by this date or the buyer is refunded"
// guarantee needs live carrier tracking + an automated refund trigger we
// don't have yet, so this stays a static explainer rather than a wired
// toggle (same treatment as Etsy Ads: named in the nav, not fabricated).

function DeliveryGuaranteeTab() {
  return (
    <div>
      <h3 className="font-semibold text-secondary text-lg mb-1 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" /> Delivery guarantee
      </h3>
      <p className="text-sm text-muted mb-4 max-w-2xl leading-relaxed">
        A delivery guarantee promises buyers a refund if their order doesn&apos;t arrive by the estimated date —
        it builds trust and can boost conversion on eligible listings.
      </p>
      <div className="border border-dashed border-border rounded-lg px-4 py-6 text-center">
        <p className="text-sm text-secondary font-medium">Not yet available for your shop</p>
        <p className="text-xs text-muted mt-1 max-w-md mx-auto">
          This requires accurate carrier tracking on every order — keep your processing profiles and
          tracking numbers up to date, and we&apos;ll let you know when your shop qualifies.
        </p>
      </div>
    </div>
  );
}

// ── Upgrades tab ───────────────────────────────────────────────────────────────

function UpgradesTab() {
  const qc = useQueryClient();
  const { alert } = useDialog();
  const { data, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: UPGRADES_KEY,
    queryFn:  () => api.get(API_ROUTES.ADMIN.SHIPPING_DELIVERY_UPGRADES),
  });
  const [saving, setSaving] = useState(false);

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.SHIPPING_DELIVERY_UPGRADES, { enabled });
      qc.setQueryData(UPGRADES_KEY, { enabled });
    } catch (err) {
      await alert((err as Error).message || 'Could not update delivery upgrades.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-semibold text-secondary text-lg mb-1">Delivery upgrades</h3>
      <p className="text-sm text-muted mb-4 max-w-2xl">
        Give buyers the option to pay for expedited delivery during checkout. Once enabled, you can add
        upgrade options to delivery profiles.
      </p>
      {isLoading ? (
        <div className="h-6 w-40 bg-muted/10 rounded animate-pulse" />
      ) : (
        <div className="space-y-2">
          {(['Enabled', 'Disabled'] as const).map((label) => {
            const value = label === 'Enabled';
            return (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  checked={data?.enabled === value}
                  disabled={saving}
                  onChange={() => setEnabled(value)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-secondary">{label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DeliverySettingsPage() {
  const [tab, setTab] = useState<Tab>('profiles');

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-secondary">Delivery settings</h1>
        <ReloadButton queryKey={PROCESSING_PROFILES_KEY} />
      </div>

      <div className="flex gap-6 border-b border-border mb-6">
        {([
          { id: 'profiles',  label: 'Delivery profiles & processing' },
          { id: 'guarantee', label: 'Delivery guarantee' },
          { id: 'upgrades',  label: 'Upgrades' },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'pb-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === t.id ? 'border-secondary text-secondary' : 'border-transparent text-muted hover:text-secondary',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-[820px] space-y-10">
        {tab === 'profiles' && (
          <>
            <ProcessingScheduleCard />
            <ProcessingProfilesSection />
            <DeliveryProfilesSection />
          </>
        )}
        {tab === 'guarantee' && <DeliveryGuaranteeTab />}
        {tab === 'upgrades' && <UpgradesTab />}
      </div>
    </>
  );
}
