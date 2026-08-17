'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Check, X as XIcon, MessageSquareShare } from 'lucide-react';
import { Toggle } from '@ezihubb/ui';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate } from '../../lib/fmt';
import { ListingPicker, type PickedProduct } from './ListingPicker';

interface OffersSettings {
  offersEnabled: boolean;
  offersScope: 'ALL_LISTINGS' | 'SPECIFIC_LISTINGS';
  offersMaxDiscountPercent: number | null;
  productIds: string[];
}

interface InboxOffer {
  id: string;
  offeredPrice: number;
  counterPrice: number | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COUNTERED';
  expiresAt: string;
  createdAt: string;
  product: { name: string; slug: string; basePrice: number; images: { url: string }[] };
  buyer: { firstName: string | null; lastName: string | null; email: string };
}

const STATUS_CFG: Record<InboxOffer['status'], { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  ACCEPTED:  { label: 'Accepted',  cls: 'bg-green-100 text-green-700' },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
  EXPIRED:   { label: 'Expired',   cls: 'bg-gray-100 text-gray-600' },
  COUNTERED: { label: 'Countered', cls: 'bg-blue-100 text-blue-700' },
};

export function BuyerOffersPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [pickedListings, setPickedListings] = useState<PickedProduct[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['offers-settings'],
    queryFn: () => api.get<OffersSettings>(API_ROUTES.ADMIN.OFFERS_SETTINGS),
  });
  const inboxQuery = useQuery({
    queryKey: ['offers-inbox'],
    queryFn: () => api.get<InboxOffer[]>(API_ROUTES.ADMIN.OFFERS_INBOX),
  });

  const settings = settingsQuery.data;
  const invalidateSettings = () => qc.invalidateQueries({ queryKey: ['offers-settings'] });
  const invalidateInbox = () => qc.invalidateQueries({ queryKey: ['offers-inbox'] });

  // Hydrate the picker with the store's already-saved listing selection —
  // without this, `pickedListings` starts empty and the next unrelated
  // settings change (e.g. adjusting the discount floor) would submit an
  // empty productIds array, silently wiping out the seller's saved listings.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !settings) return;
    hydratedRef.current = true;
    if (settings.offersScope === 'SPECIFIC_LISTINGS' && settings.productIds.length > 0) {
      // The products list endpoint has no `ids` filter (ProductQueryDto
      // doesn't declare one, so NestJS's whitelist strips it silently) —
      // fetch each saved listing individually by ID instead.
      Promise.all(settings.productIds.map((id) => api.get<PickedProduct>(API_ROUTES.ADMIN.PRODUCT(id)).catch(() => null)))
        .then((results) => setPickedListings(results.filter((p): p is PickedProduct => !!p)));
    }
  }, [settings]);

  const updateSettings = async (patch: Partial<OffersSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    await api.patch(API_ROUTES.ADMIN.OFFERS_SETTINGS, {
      offersEnabled: next.offersEnabled,
      offersScope: next.offersScope,
      offersMaxDiscountPercent: next.offersMaxDiscountPercent,
      productIds: next.offersScope === 'SPECIFIC_LISTINGS' ? pickedListings.map((p) => p.id) : undefined,
    });
    invalidateSettings();
  };

  const accept = async (id: string) => { await api.post(API_ROUTES.ADMIN.OFFER_ACCEPT(id), {}); invalidateInbox(); };
  const reject = async (id: string) => { await api.post(API_ROUTES.ADMIN.OFFER_REJECT(id), {}); invalidateInbox(); };
  const submitCounter = async (id: string) => {
    const price = Number(counterAmount);
    if (!price || price <= 0) return;
    await api.post(API_ROUTES.ADMIN.OFFER_COUNTER(id), { counterPrice: price });
    setCounteringId(null);
    setCounterAmount('');
    invalidateInbox();
  };

  const offers = inboxQuery.data ?? [];

  return (
    <div className={embedded ? '' : 'mt-10'}>
      {!embedded && (
        <div className="mb-4">
          <h2 className="font-bold text-secondary text-base flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-primary" />
            Let buyers make offers
          </h2>
          <p className="text-xs text-muted mt-0.5">Buyers can propose a lower price on eligible listings for you to accept, reject, or counter.</p>
        </div>
      )}

      {settings && (
        <div className="bg-surface rounded-card border border-border shadow-card p-4 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-secondary">Accept offers</p>
            <Toggle
              checked={settings.offersEnabled}
              onChange={(v) => updateSettings({ offersEnabled: v })}
              ariaLabel="Accept offers"
            />
          </div>

          {settings.offersEnabled && (
            <>
              <div className="flex gap-2">
                <button type="button" onClick={() => updateSettings({ offersScope: 'ALL_LISTINGS' })}
                  className={`flex-1 px-3 py-1.5 rounded-button border text-xs font-semibold transition-colors ${settings.offersScope === 'ALL_LISTINGS' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted'}`}>
                  All listings
                </button>
                <button type="button" onClick={() => updateSettings({ offersScope: 'SPECIFIC_LISTINGS' })}
                  className={`flex-1 px-3 py-1.5 rounded-button border text-xs font-semibold transition-colors ${settings.offersScope === 'SPECIFIC_LISTINGS' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted'}`}>
                  Select listings
                </button>
              </div>

              {settings.offersScope === 'SPECIFIC_LISTINGS' && (
                <ListingPicker selected={pickedListings} onChange={setPickedListings} />
              )}

              <div>
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">
                  Lowest offer accepted (% off) — leave blank to receive all offers
                </label>
                <input
                  type="number" min={0} max={90}
                  value={settings.offersMaxDiscountPercent ?? ''}
                  onChange={(e) => updateSettings({ offersMaxDiscountPercent: e.target.value ? Number(e.target.value) : null })}
                  className="w-40 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="No limit"
                />
              </div>
            </>
          )}
        </div>
      )}

      {settings?.offersEnabled && (
        <div className="space-y-2">
          {offers.length === 0 ? (
            <div className="bg-surface rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
              No offers yet.
            </div>
          ) : (
            offers.map((o) => {
              const statusCfg = STATUS_CFG[o.status];
              const buyerName = `${o.buyer.firstName ?? ''} ${o.buyer.lastName ?? ''}`.trim() || o.buyer.email;
              return (
                <div key={o.id} className="flex items-center gap-3 p-3 bg-surface rounded-card border border-border">
                  {o.product.images[0] ? <img src={o.product.images[0].url} alt="" className="w-11 h-11 rounded object-cover shrink-0" /> : <div className="w-11 h-11 rounded bg-muted/10 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-secondary truncate">{o.product.name}</p>
                    <p className="text-xs text-muted">{buyerName} offered <span className="font-semibold text-secondary">${Number(o.offeredPrice).toFixed(2)}</span> on ${Number(o.product.basePrice).toFixed(2)}</p>
                    {o.counterPrice !== null && <p className="text-[11px] text-blue-600">You countered with ${Number(o.counterPrice).toFixed(2)}</p>}
                    <p className="text-[10px] text-muted mt-0.5">Expires {fmtDate(o.expiresAt)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-pill shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                  {o.status === 'PENDING' && (
                    <div className="flex items-center gap-1 shrink-0">
                      {counteringId === o.id ? (
                        <>
                          <input
                            type="number" autoFocus value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)}
                            className="w-20 px-2 py-1 text-xs border border-border rounded-button bg-background"
                            placeholder="$"
                          />
                          <button type="button" onClick={() => submitCounter(o.id)} className="p-1.5 rounded text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setCounteringId(null)} className="p-1.5 rounded text-muted hover:bg-muted/10"><XIcon className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => accept(o.id)} title="Accept" className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setCounteringId(o.id)} title="Counter" className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><MessageSquareShare className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => reject(o.id)} title="Reject" className="p-1.5 rounded text-red-500 hover:bg-red-50"><XIcon className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
