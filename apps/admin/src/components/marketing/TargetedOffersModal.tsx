'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, Percent, DollarSign, Eye, Heart, PackageCheck, ShoppingCart } from 'lucide-react';
import { Modal, ModalHeroHeader, Button, Toggle } from '@ezihubb/ui';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

type Trigger = 'INTERESTED_SHOPPER' | 'THANK_YOU' | 'ABANDONED_BASKET' | 'FAVOURITED_ITEM';
/** Re-exported so the page holding the modal open can name which card it was. */
export type TargetedOfferTrigger = Trigger;
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

interface Campaign {
  id:               string | null;
  storeId:          string;
  trigger:          Trigger;
  discountType:     DiscountType;
  discountValue:    number;
  expiresAfterDays: number;
  lookbackDays:     number;
  isActive:         boolean;
}

const TRIGGER_META: Record<Trigger, { icon: React.ElementType; label: string; desc: string; hasLookback: boolean }> = {
  INTERESTED_SHOPPER: { icon: Eye,           label: 'Interested shopper', desc: 'Someone viewed your listings more than once without buying', hasLookback: true },
  THANK_YOU:           { icon: PackageCheck,  label: 'Thank you',          desc: 'Sent automatically after an order ships',                     hasLookback: false },
  ABANDONED_BASKET:    { icon: ShoppingCart,  label: 'Abandoned basket',   desc: 'Items were left in a cart without checking out',              hasLookback: true },
  FAVOURITED_ITEM:     { icon: Heart,         label: 'Favourited item',    desc: 'Someone favourited one of your listings',                     hasLookback: false },
};

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

interface TargetedOffersModalProps {
  onClose: () => void;
  /**
   * Which offer the seller clicked to get here.
   *
   * Five cards opened this same modal with no argument, so it always rendered
   * the same undifferentiated list of four switches and the seller had to find
   * their way back to the one they had just chosen.
   *
   * That offer is switched on as the modal opens, which is safe to do without
   * asking: activating a campaign only writes the row. Nothing is sent at that
   * moment — the emails come from fireOffer, which runs when a buyer takes an
   * action and re-reads isActive at that point. Switching it back off before
   * anyone triggers it leaves no trace.
   */
  focusTrigger?: Trigger;
}

export function TargetedOffersModal({ onClose, focusTrigger }: TargetedOffersModalProps) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [saving, setSaving] = useState<Trigger | null>(null);
  /**
   * Rows whose settings are open, independent of whether the campaign is live.
   *
   * These used to be the same thing: the panel appeared only once isActive was
   * true, so there was no way to read the discount a campaign would send
   * before committing to send it.
   */
  const [expanded, setExpanded] = useState<Set<Trigger>>(
    () => new Set(focusTrigger ? [focusTrigger] : []),
  );
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Campaign[]>(API_ROUTES.ADMIN.TARGETED_OFFERS).then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // After the list renders, not before: the row does not exist until then.
  useEffect(() => {
    if (campaigns && focusTrigger) focusRef.current?.scrollIntoView({ block: 'center' });
  }, [campaigns, focusTrigger]);

  /**
   * Switch on the offer whose card opened this — once, and only if it is off.
   *
   * The guard matters in both directions. `toggle` FLIPS, so calling it on a
   * campaign that is already live would switch it off, turning "set this up"
   * into "cancel it". And the ref stops a re-render from flipping it a second
   * time, which would do exactly the same thing a moment later.
   */
  const autoEnabled = useRef(false);
  useEffect(() => {
    if (!campaigns || !focusTrigger || autoEnabled.current) return;
    const target = campaigns.find((c) => c.trigger === focusTrigger);
    if (!target) return;                 // list not loaded far enough; try again
    autoEnabled.current = true;
    if (!target.isActive) void toggle(target);
    // `toggle` is rebuilt every render; depending on it would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns, focusTrigger]);

  const update = (trigger: Trigger, patch: Partial<Campaign>) => {
    setCampaigns((prev) => prev?.map((c) => (c.trigger === trigger ? { ...c, ...patch } : c)) ?? null);
  };

  const save = async (c: Campaign) => {
    setSaving(c.trigger);
    try {
      await api.post(API_ROUTES.ADMIN.TARGETED_OFFERS, {
        trigger: c.trigger,
        discountType: c.discountType,
        discountValue: c.discountValue,
        expiresAfterDays: c.expiresAfterDays,
        lookbackDays: c.lookbackDays,
        isActive: c.isActive,
      });
    } finally {
      setSaving(null);
    }
  };

  const toggle = async (c: Campaign) => {
    const next = { ...c, isActive: !c.isActive };
    update(c.trigger, { isActive: next.isActive });
    await save(next);
  };

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalHeroHeader
        icon={<Mail className="w-7 h-7" />}
        title="Set up targeted offers"
        subtitle="After an eligible buyer takes an action in your shop, targeted offers are shared automatically by email."
        band="periwinkle"
        onClose={onClose}
      />
      <div className="overflow-y-auto">
        <div className="px-6 py-5 space-y-3">
          {!campaigns ? (
            <div className="h-40 bg-background rounded-card animate-pulse" />
          ) : (
            campaigns.map((c) => {
              const meta = TRIGGER_META[c.trigger];
              const Icon = meta.icon;
              const isFocused = c.trigger === focusTrigger;
              const isOpen    = c.isActive || expanded.has(c.trigger);
              return (
                <div
                  key={c.trigger}
                  ref={isFocused ? focusRef : undefined}
                  className={[
                    'rounded-card border transition-colors',
                    c.isActive ? 'border-primary/40 bg-primary/[0.03]' : 'border-border',
                    // Marks the row the seller picked, but only while it is
                    // off — once it is live the active styling already says
                    // which one it is, and two markers on one row is noise.
                    // Reached when the auto-enable was skipped or its request
                    // failed, so it doubles as "this is the one that did not
                    // switch on".
                    isFocused && !c.isActive ? 'ring-2 ring-primary/30' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.isActive ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted'}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    {/* Opens the settings without switching the campaign on.
                        The toggle beside it is the thing that goes live. */}
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.trigger)) next.delete(c.trigger); else next.add(c.trigger);
                        return next;
                      })}
                      className="flex-1 min-w-0 text-left"
                      aria-expanded={isOpen}
                    >
                      <p className="text-sm font-semibold text-secondary">{meta.label}</p>
                      <p className="text-xs text-muted">{meta.desc}</p>
                    </button>
                    <Toggle checked={c.isActive} onChange={() => toggle(c)} ariaLabel={`Toggle ${meta.label}`} />
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/60 grid grid-cols-2 gap-3">
                      <div className="col-span-2 flex gap-2">
                        <button type="button" onClick={() => update(c.trigger, { discountType: 'PERCENTAGE' })}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-button border text-xs font-semibold transition-colors ${c.discountType === 'PERCENTAGE' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted'}`}>
                          <Percent className="w-3 h-3" /> Percentage
                        </button>
                        <button type="button" onClick={() => update(c.trigger, { discountType: 'FIXED_AMOUNT' })}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-button border text-xs font-semibold transition-colors ${c.discountType === 'FIXED_AMOUNT' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted'}`}>
                          <DollarSign className="w-3 h-3" /> Fixed amount
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Discount</label>
                        <input type="number" min={0.01} value={c.discountValue} onChange={(e) => update(c.trigger, { discountValue: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Code expires after (days)</label>
                        <input type="number" min={1} max={30} value={c.expiresAfterDays} onChange={(e) => update(c.trigger, { expiresAfterDays: Number(e.target.value) })} className={inputCls} />
                      </div>
                      {meta.hasLookback && (
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Lookback window (days)</label>
                          <input type="number" min={1} max={90} value={c.lookbackDays} onChange={(e) => update(c.trigger, { lookbackDays: Number(e.target.value) })} className={inputCls} />
                        </div>
                      )}
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={() => save(c)}
                          disabled={saving === c.trigger}
                          className="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-button transition-colors disabled:opacity-50"
                        >
                          {saving === c.trigger ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4">
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
