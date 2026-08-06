'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Package, X, Trash2, Plug } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ─── Layout primitives (mirrors PricingShippingTab.tsx's conventions) ─────────

function TabSection({ title, description, link, children }: {
  title:       string;
  description?: string;
  link?:       { label: string; href: string };
  children:    React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-secondary">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5 max-w-xl">{description}</p>}
        </div>
        {link && (
          <a href={link.href} className="shrink-0 flex items-center gap-1 text-sm text-primary hover:underline">
            {link.label} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FulfillmentConnection {
  id:               string;
  provider:         string;
  status:           'ACTIVE' | 'INVALID' | 'DISCONNECTED';
  externalShopName: string | null;
  externalShopId:   string;
}

interface ShopProductVariant { externalVariantId: string; title: string }
interface ShopProduct {
  externalProductId: string;
  title:              string;
  thumbnailUrl?:      string;
  variants:           ShopProductVariant[];
}

interface Mapping {
  id:                 string;
  connectionId:       string;
  productId:          string;
  variantId:          string | null;
  externalProductId:  string;
  externalVariantId:  string;
}

const CONNECTIONS_KEY = ['admin-fulfillment-connections'];
const mappingsKey = (productId: string) => ['admin-fulfillment-mappings', productId];

// ─── Shop product picker ──────────────────────────────────────────────────────

function ShopProductPickerModal({ connectionId, onSelect, onClose }: {
  connectionId: string;
  onSelect:     (product: ShopProduct, variant: ShopProductVariant) => void;
  onClose:      () => void;
}) {
  const { data: products = [], isLoading } = useQuery<ShopProduct[]>({
    queryKey: ['admin-fulfillment-shop-products', connectionId],
    queryFn:  () => api.get<ShopProduct[]>(API_ROUTES.ADMIN.FULFILLMENT_SHOP_PRODUCTS(connectionId)),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h4 className="font-semibold text-secondary">Select a product from your shop</h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3 space-y-3 max-h-96 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted py-4 text-center">Loading your shop's products…</p>}
          {!isLoading && products.length === 0 && (
            <p className="text-sm text-muted py-4 text-center">No products found in this shop yet.</p>
          )}
          {products.map((p) => (
            <div key={p.externalProductId} className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                {p.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                )}
                <p className="text-sm font-semibold text-secondary truncate">{p.title}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.variants.map((v) => (
                  <button
                    key={v.externalVariantId}
                    type="button"
                    onClick={() => { onSelect(p, v); onClose(); }}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function FulfillmentTab({ productId }: { productId?: string }) {
  const qc = useQueryClient();
  const [pickerConnectionId, setPickerConnectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: connections = [] } = useQuery<FulfillmentConnection[]>({
    queryKey: CONNECTIONS_KEY,
    queryFn:  () => api.get<FulfillmentConnection[]>(API_ROUTES.ADMIN.FULFILLMENT_CONNECTIONS),
    staleTime: 60_000,
  });
  const activeConnections = connections.filter((c) => c.status === 'ACTIVE');

  const { data: mappings = [] } = useQuery<Mapping[]>({
    queryKey: mappingsKey(productId ?? ''),
    queryFn:  () => api.get<Mapping[]>(API_ROUTES.ADMIN.FULFILLMENT_MAPPINGS),
    enabled:  !!productId,
    staleTime: 30_000,
    select:   (all) => all.filter((m) => m.productId === productId),
  });
  const mapping = mappings[0]; // whole-product mapping (single variant flows) for phase 1

  const handleSelect = async (connectionId: string, product: ShopProduct, variant: ShopProductVariant) => {
    if (!productId) return;
    setSaving(true);
    try {
      await api.put(API_ROUTES.ADMIN.FULFILLMENT_MAPPINGS, {
        connectionId,
        productId,
        externalProductId: product.externalProductId,
        externalVariantId: variant.externalVariantId,
      });
      void qc.invalidateQueries({ queryKey: mappingsKey(productId) });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!mapping) return;
    await api.delete(API_ROUTES.ADMIN.FULFILLMENT_MAPPING_DELETE(mapping.id));
    void qc.invalidateQueries({ queryKey: mappingsKey(productId ?? '') });
  };

  if (!productId) {
    return (
      <TabSection title="Fulfillment">
        <p className="text-sm text-muted">Save this product first to connect it to a fulfillment provider.</p>
      </TabSection>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden divide-y divide-border">
        <TabSection
          title="Fulfillment provider"
          description="Automatically send orders for this product to a print-on-demand provider like Printify. Leave unmapped to fulfill it yourself as usual."
          link={{ label: 'Manage connections', href: '/settings/fulfillment' }}
        >
          {activeConnections.length === 0 ? (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-lg border border-dashed border-border bg-background">
              <Plug className="w-4 h-4 text-muted shrink-0 mt-0.5" />
              <p className="text-sm text-muted">
                No fulfillment provider connected yet.{' '}
                <a href="/settings/fulfillment" className="text-primary hover:underline">Connect one in Settings →</a>
              </p>
            </div>
          ) : mapping ? (
            <div className="flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 border-border bg-background">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary">Mapped to provider product</p>
                <p className="text-xs text-muted mt-0.5">
                  External product {mapping.externalProductId} · variant {mapping.externalVariantId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-button hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Unmap
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeConnections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={saving}
                  onClick={() => setPickerConnectionId(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors text-left disabled:opacity-50"
                >
                  <Plug className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-secondary">
                    Map to a product in {c.provider} — {c.externalShopName ?? c.externalShopId}
                  </span>
                </button>
              ))}
            </div>
          )}
        </TabSection>
      </div>

      {pickerConnectionId && (
        <ShopProductPickerModal
          connectionId={pickerConnectionId}
          onSelect={(product, variant) => handleSelect(pickerConnectionId, product, variant)}
          onClose={() => setPickerConnectionId(null)}
        />
      )}
    </div>
  );
}
