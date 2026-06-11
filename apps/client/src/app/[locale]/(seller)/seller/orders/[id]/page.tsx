'use client';

import { useState } from 'react';
import { use } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { apiClient } from '@mlh/api-client';
import { useAuthQuery, useAuthMutation } from '../../../../../../lib/hooks/useAuthQuery';

interface OrderItem {
  id:             string;
  productName:    string;
  variantName:    string | null;
  quantity:       number;
  unitPrice:      number;
  productImageUrl:string | null;
}

interface StoreOrderDetail {
  id:             string;
  status:         string;
  subtotal:       number;
  shippingCost:   number;
  platformFee:    number;
  sellerEarnings: number;
  trackingNumber: string | null;
  trackingUrl:    string | null;
  carrier:        string | null;
  shippedAt:      string | null;
  deliveredAt:    string | null;
  sellerNotes:    string | null;
  createdAt:      string;
  order: {
    orderNumber:  string;
    shippingCity: string | null;
    createdAt:    string;
  };
  items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED:    'bg-purple-100 text-purple-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const NEXT_STATUS: Record<string, string | null> = {
  CONFIRMED:  'PROCESSING',
  PROCESSING: null, // use mark-shipped flow
  SHIPPED:    'DELIVERED',
};

const fmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const locale  = useLocale();
  const router  = useRouter();

  const [tracking, setTracking] = useState('');
  const [carrier,  setCarrier ] = useState('');
  const [notes,    setNotes   ] = useState('');
  const [shipMode, setShipMode] = useState(false);

  const queryKey = ['seller', 'order', id];

  const { data: order, isLoading } = useAuthQuery<StoreOrderDetail>(
    queryKey,
    `/seller/orders/${id}`,
  );

  const updateMutation = useAuthMutation(
    (vars: { status?: string; sellerNotes?: string }, token) =>
      apiClient.patch(`/seller/orders/${id}`, vars, { token }),
    { invalidateKeys: [queryKey, ['seller', 'orders']] },
  );

  const shipMutation = useAuthMutation(
    (vars: { trackingNumber: string; carrier?: string }, token) =>
      apiClient.post(`/seller/orders/${id}/ship`, vars, { token }),
    {
      invalidateKeys: [queryKey, ['seller', 'orders']],
      onSuccess: () => setShipMode(false),
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="rect" className="h-40 rounded-card" />
        <Skeleton variant="rect" className="h-40 rounded-card" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Order not found.</p>
      </div>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 border border-border rounded-button hover:border-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-secondary">
            Order {order.order.orderNumber}
          </h1>
          <p className="text-xs text-muted">{fmt.format(new Date(order.order.createdAt))}</p>
        </div>
        <span
          className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-muted/10 text-muted'}`}
        >
          {order.status}
        </span>
      </div>

      {/* Items */}
      <section className="border border-border rounded-card overflow-hidden">
        <div className="px-4 py-3 bg-background border-b border-border">
          <h2 className="font-semibold text-secondary text-sm">Items</h2>
        </div>
        <div className="divide-y divide-border">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-12 h-12 bg-muted/10 rounded-sm shrink-0 overflow-hidden">
                {item.productImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary truncate">{item.productName}</p>
                {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-secondary tabular-nums">
                  ${item.unitPrice.toFixed(2)}
                </p>
                <p className="text-xs text-muted">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-background border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Platform fee</span><span>−${order.platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-secondary pt-1 border-t border-border">
            <span>Your earnings</span><span>${order.sellerEarnings.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Tracking */}
      {order.trackingNumber && (
        <section className="border border-border rounded-card p-4 space-y-1">
          <h2 className="font-semibold text-secondary text-sm mb-2">Tracking</h2>
          <p className="text-sm text-secondary">
            {order.carrier && <span className="font-medium">{order.carrier}: </span>}
            {order.trackingNumber}
          </p>
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Track package <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </section>
      )}

      {/* Seller notes */}
      <section className="border border-border rounded-card p-4">
        <h2 className="font-semibold text-secondary text-sm mb-2">Seller Notes</h2>
        <textarea
          value={notes || order.sellerNotes || ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add private notes for this order..."
          rows={3}
          className="w-full text-sm border border-border rounded-button px-3 py-2 resize-none focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={() => updateMutation.mutate({ sellerNotes: notes })}
          disabled={updateMutation.isPending}
          className="mt-2 text-sm font-medium text-secondary border border-border rounded-button px-4 py-2 hover:border-primary transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Notes'}
        </button>
      </section>

      {/* Actions */}
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
        <section className="border border-border rounded-card p-4 space-y-4">
          <h2 className="font-semibold text-secondary text-sm">Actions</h2>

          {/* Mark Processing */}
          {nextStatus === 'PROCESSING' && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ status: 'PROCESSING' })}
              disabled={updateMutation.isPending}
              className="w-full bg-primary text-white font-bold text-sm px-4 py-3 rounded-button hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Mark as Processing
            </button>
          )}

          {/* Mark Delivered */}
          {nextStatus === 'DELIVERED' && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ status: 'DELIVERED' })}
              disabled={updateMutation.isPending}
              className="w-full bg-green-600 text-white font-bold text-sm px-4 py-3 rounded-button hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Mark as Delivered
            </button>
          )}

          {/* Mark Shipped */}
          {order.status === 'PROCESSING' && (
            <div>
              {!shipMode ? (
                <button
                  type="button"
                  onClick={() => setShipMode(true)}
                  className="w-full border border-primary text-primary font-bold text-sm px-4 py-3 rounded-button hover:bg-primary/5 transition-colors"
                >
                  Mark as Shipped
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-secondary">Enter tracking info</p>
                  <input
                    type="text"
                    placeholder="Tracking number *"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className="w-full text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Carrier (e.g. USPS, FedEx)"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => shipMutation.mutate({ trackingNumber: tracking, carrier: carrier || undefined })}
                      disabled={!tracking || shipMutation.isPending}
                      className="flex-1 bg-primary text-white font-bold text-sm px-4 py-2.5 rounded-button hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                      {shipMutation.isPending ? 'Submitting…' : 'Confirm Shipment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShipMode(false)}
                      className="px-4 py-2.5 border border-border rounded-button text-sm text-secondary hover:border-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
