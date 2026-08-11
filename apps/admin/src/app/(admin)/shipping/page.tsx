'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, ChevronDown, ChevronRight, Pencil, Trash2,
  Truck, Save, Globe,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import {
  ShippingZoneModal,
  COUNTRIES,
  type ShippingZoneFormData,
} from '../../../components/shipping/ShippingZoneModal';
import {
  ShippingMethodModal,
  type ShippingMethod,
  type ShippingMethodFormData,
} from '../../../components/shipping/ShippingMethodModal';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Toggle as PrimitiveToggle } from '../../../components/products/edit/primitives';
import { fmtAmount } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShippingZone {
  id:       string;
  name:     string;
  countries: string[];
  methods:  ShippingMethod[];
}

interface ShippingSettings {
  freeShippingEnabled:    boolean;
  freeShippingMinAmount:  number;
  freeShippingZoneIds:    string[];
  defaultProcessingDays:  number;
  showEstimatedDelivery:  boolean;
  showCarrierInCheckout:  boolean;
}

// ── Country helpers ───────────────────────────────────────────────────────────

function countryFlag(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? '🌍';
}

// ── Settings card ─────────────────────────────────────────────────────────────

function SettingsCard({
  title,
  children,
  onSave,
  saving,
}: {
  title:    string;
  children: React.ReactNode;
  onSave:   () => void;
  saving?:  boolean;
}) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-5 space-y-4">
      <h4 className="font-semibold text-secondary text-sm">{title}</h4>
      {children}
      <div className="pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-button transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked:  boolean;
  onChange: (v: boolean) => void;
  label:    string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <PrimitiveToggle checked={checked} onChange={onChange} ariaLabel={label} />
      <span className="text-sm text-secondary">{label}</span>
    </label>
  );
}

// ── Zone accordion card ───────────────────────────────────────────────────────

function ZoneCard({
  zone,
  onEditZone,
  onDeleteZone,
  onAddMethod,
  onEditMethod,
  onDeleteMethod,
}: {
  zone:           ShippingZone;
  onEditZone:     (z: ShippingZone) => void;
  onDeleteZone:   (id: string) => void;
  onAddMethod:    (z: ShippingZone) => void;
  onEditMethod:   (z: ShippingZone, m: ShippingMethod) => void;
  onDeleteMethod: (zoneId: string, methodId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Determine a representative flag
  const primaryFlag = zone.countries.length > 0 ? countryFlag(zone.countries[0]) : '🌍';

  return (
    <div className="border border-border rounded-card overflow-hidden">
      {/* Zone header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-background cursor-pointer hover:bg-muted/5 transition-colors select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-muted shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        }

        <span className="text-lg leading-none">{primaryFlag}</span>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-secondary text-sm">{zone.name}</p>
        </div>

        {/* Country count badge */}
        <span className="text-xs font-semibold bg-muted/10 text-muted rounded-pill px-2 py-0.5 tabular-nums shrink-0">
          {zone.countries.length} countr{zone.countries.length !== 1 ? 'ies' : 'y'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEditZone(zone)}
            className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors"
            title="Edit zone"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteZone(zone.id)}
            className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
            title="Delete zone"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone body */}
      {expanded && (
        <div className="border-t border-border">
          {/* Country pills */}
          <div className="px-4 py-2.5 bg-muted/3 border-b border-border flex flex-wrap gap-1.5">
            {zone.countries.slice(0, 8).map((code) => (
              <span key={code} className="inline-flex items-center gap-1 text-xs bg-background border border-border rounded-pill px-2 py-0.5">
                <span>{countryFlag(code)}</span>
                <span className="text-muted font-mono">{code}</span>
              </span>
            ))}
            {zone.countries.length > 8 && (
              <span className="text-xs text-muted px-2 py-0.5">+{zone.countries.length - 8} more</span>
            )}
          </div>

          {/* Methods */}
          {(zone.methods ?? []).length > 0 && (
            <div className="divide-y divide-border">
              {(zone.methods ?? []).map((method) => (
                <div key={method.id} className="flex items-center gap-3 px-4 h-12">
                  <Truck className="w-4 h-4 text-muted shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{method.name}</p>
                  </div>

                  <span className="text-xs text-muted shrink-0">{method.carrier ?? '—'}</span>

                  <span className="text-xs text-muted shrink-0 tabular-nums">
                    {method.minDays}–{method.maxDays} days
                  </span>

                  <span className={`text-sm font-semibold shrink-0 tabular-nums ${Number(method.price) === 0 ? 'text-green-600' : 'text-secondary'}`}>
                    {Number(method.price) === 0 ? 'Free' : fmtAmount(method.price)}
                  </span>

                  {!method.isActive && (
                    <span className="text-[10px] font-semibold text-muted bg-muted/10 px-1.5 py-0.5 rounded-pill shrink-0">Inactive</span>
                  )}

                  <div className="flex items-center gap-1 ml-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditMethod(zone, method)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMethod(zone.id, method.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(zone.methods ?? []).length === 0 && (
            <p className="text-xs text-muted text-center py-4">No shipping methods yet.</p>
          )}

          {/* Add method */}
          <div className="px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={() => onAddMethod(zone)}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-muted border border-dashed border-border rounded-button py-2 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Shipping Method
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShippingPage() {
  const qc = useQueryClient();
  const { confirm, alert } = useDialog();

  // ── Zones ─────────────────────────────────────────────────────────────────

  const zonesQuery = useQuery<ShippingZone[]>({
    queryKey: ['admin-shipping-zones'],
    queryFn:  () => api.get<ShippingZone[]>(API_ROUTES.ADMIN.SHIPPING_ZONES),
  });

  const zones = zonesQuery.data ?? [];

  // ── Settings ───────────────────────────────────────────────────────────────

  const settingsQuery = useQuery<ShippingSettings>({
    queryKey: ['admin-shipping-settings'],
    queryFn:  () => api.get<ShippingSettings>(API_ROUTES.ADMIN.SHIPPING_SETTINGS),
    staleTime: 60_000,
  });

  const [settings,       setSettings]       = useState<ShippingSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);

  // Sync settings from query into local state
  const s = settings ?? settingsQuery.data ?? {
    freeShippingEnabled:   false,
    freeShippingMinAmount: 50,
    freeShippingZoneIds:   [],
    defaultProcessingDays: 2,
    showEstimatedDelivery: true,
    showCarrierInCheckout: true,
  };

  const setS = (patch: Partial<ShippingSettings>) =>
    setSettings((prev) => ({ ...(prev ?? s), ...patch }));

  const saveSettings = async (section: string) => {
    setSettingsSaving(section);
    try {
      await api.patch(API_ROUTES.ADMIN.SHIPPING_SETTINGS, s);
      qc.invalidateQueries({ queryKey: ['admin-shipping-settings'] });
    } catch (err) {
      await alert((err as Error).message || 'Could not save shipping settings.', { variant: 'error' });
    } finally { setSettingsSaving(null); }
  };

  // ── Zone modal state ───────────────────────────────────────────────────────

  const [zoneModal,   setZoneModal]   = useState<ShippingZone | null | 'new'>(null);
  const [methodModal, setMethodModal] = useState<{ zone: ShippingZone; method?: ShippingMethod } | null>(null);

  const invalidateZones = () => qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] });

  const handleSaveZone = async (data: ShippingZoneFormData, id?: string) => {
    try {
      if (id) {
        await api.patch(API_ROUTES.ADMIN.SHIPPING_ZONE(id), data);
      } else {
        await api.post(API_ROUTES.ADMIN.SHIPPING_ZONES, data);
      }
      invalidateZones();
      setZoneModal(null);
    } catch (err) {
      await alert((err as Error).message || 'Could not save this shipping zone.', { variant: 'error' });
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!await confirm('Delete this shipping zone and all its methods?', { confirmLabel: 'Delete zone', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.SHIPPING_ZONE(id));
      invalidateZones();
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this shipping zone.', { variant: 'error' });
    }
  };

  const handleSaveMethod = async (data: ShippingMethodFormData, zoneId: string, methodId?: string) => {
    try {
      if (methodId) {
        await api.patch(`${API_ROUTES.ADMIN.SHIPPING_ZONE_METHODS(zoneId)}/${methodId}`, data);
      } else {
        await api.post(API_ROUTES.ADMIN.SHIPPING_ZONE_METHODS(zoneId), data);
      }
      invalidateZones();
      setMethodModal(null);
    } catch (err) {
      await alert((err as Error).message || 'Could not save this shipping method.', { variant: 'error' });
    }
  };

  const handleDeleteMethod = async (zoneId: string, methodId: string) => {
    if (!await confirm('Delete this shipping method?', { confirmLabel: 'Delete method', destructive: true })) return;
    try {
      await api.delete(`${API_ROUTES.ADMIN.SHIPPING_ZONE_METHODS(zoneId)}/${methodId}`);
      invalidateZones();
    } catch (err) {
      await alert((err as Error).message || 'Could not delete this shipping method.', { variant: 'error' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Shipping"
        subtitle="Manage shipping zones, methods, and delivery settings"
        queryKey={['admin-shipping-zones']}
      />

      <div className="grid grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── LEFT: Shipping zones ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-secondary flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted" />
              Shipping Zones
              {zones.length > 0 && (
                <span className="text-xs font-semibold text-muted bg-muted/10 px-2 py-0.5 rounded-pill">{zones.length}</span>
              )}
            </h4>
            <button
              type="button"
              onClick={() => setZoneModal('new')}
              className="flex items-center gap-1.5 text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/5 px-3 py-2 rounded-button transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Zone
            </button>
          </div>

          {zonesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 bg-surface border border-border rounded-card animate-pulse" />
              ))}
            </div>
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-card">
              <Truck className="w-10 h-10 text-muted/30 mb-3" />
              <p className="font-semibold text-secondary">No shipping zones yet</p>
              <p className="text-sm text-muted mt-1">Create your first zone to start configuring rates.</p>
              <button
                type="button"
                onClick={() => setZoneModal('new')}
                className="mt-4 flex items-center gap-1.5 text-sm font-semibold bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-button transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Shipping Zone
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  onEditZone={(z) => setZoneModal(z)}
                  onDeleteZone={handleDeleteZone}
                  onAddMethod={(z) => setMethodModal({ zone: z })}
                  onEditMethod={(z, m) => setMethodModal({ zone: z, method: m })}
                  onDeleteMethod={handleDeleteMethod}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Settings panel ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Free shipping threshold */}
          <SettingsCard
            title="🚚 Free Shipping Threshold"
            onSave={() => saveSettings('free')}
            saving={settingsSaving === 'free'}
          >
            <Toggle
              checked={s.freeShippingEnabled}
              onChange={(v) => setS({ freeShippingEnabled: v })}
              label="Enable global free shipping threshold"
            />

            {s.freeShippingEnabled && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Minimum order amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={s.freeShippingMinAmount}
                      onChange={(e) => setS({ freeShippingMinAmount: Number(e.target.value) })}
                      className="w-full pl-7 pr-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <p className="text-xs text-muted/70 mt-1">Applied after discounts are deducted.</p>
                </div>

                {zones.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                      Apply to zones
                    </label>
                    <div className="space-y-1.5">
                      {zones.map((z) => (
                        <label key={z.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.freeShippingZoneIds.includes(z.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...s.freeShippingZoneIds, z.id]
                                : s.freeShippingZoneIds.filter((id) => id !== z.id);
                              setS({ freeShippingZoneIds: ids });
                            }}
                            className="w-4 h-4 accent-primary rounded"
                          />
                          <span className="text-sm text-secondary">{z.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </SettingsCard>

          {/* Production time */}
          <SettingsCard
            title="⚙️ Production Time"
            onSave={() => saveSettings('production')}
            saving={settingsSaving === 'production'}
          >
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                Default processing days
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={s.defaultProcessingDays}
                onChange={(e) => setS({ defaultProcessingDays: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted/70 mt-1.5">
                Added to all shipping estimates for print-on-demand products.
              </p>
            </div>
          </SettingsCard>

          {/* Display settings */}
          <SettingsCard
            title="🖥 Display Settings"
            onSave={() => saveSettings('display')}
            saving={settingsSaving === 'display'}
          >
            <div className="space-y-3">
              <Toggle
                checked={s.showEstimatedDelivery}
                onChange={(v) => setS({ showEstimatedDelivery: v })}
                label="Show estimated delivery dates on product pages"
              />
              <Toggle
                checked={s.showCarrierInCheckout}
                onChange={(v) => setS({ showCarrierInCheckout: v })}
                label="Show carrier name in checkout"
              />
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* ── Zone modal ────────────────────────────────────────────────────── */}
      {zoneModal !== null && (
        <ShippingZoneModal
          zone={zoneModal === 'new' ? null : zoneModal}
          onClose={() => setZoneModal(null)}
          onSave={handleSaveZone}
        />
      )}

      {/* ── Method modal ──────────────────────────────────────────────────── */}
      {methodModal && (
        <ShippingMethodModal
          zoneName={methodModal.zone.name}
          zoneId={methodModal.zone.id}
          method={methodModal.method ?? null}
          onClose={() => setMethodModal(null)}
          onSave={handleSaveMethod}
        />
      )}
    </>
  );
}
