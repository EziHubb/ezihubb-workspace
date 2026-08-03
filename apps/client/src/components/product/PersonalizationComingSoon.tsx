'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Palette, ShoppingCart, Bell } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';
import { useCartStore } from '../../lib/store/cart.store';
import type { ProductDto, ProductVariantDto } from '@ezihubb/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PersonalizationComingSoonProps {
  product:         ProductDto;
  selectedVariant: ProductVariantDto | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonalizationComingSoon({
  product,
  selectedVariant,
}: PersonalizationComingSoonProps) {
  const t          = useTranslations('product');
  const user       = useAuthStore((s) => s.user);
  const { addItem } = useCartStore();
  const openDrawer = useCartStore((s) => s.openDrawer);

  const [notifyEmail,  setNotifyEmail]  = useState(user?.email ?? '');
  const [notifyState,  setNotifyState]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isAdding,     setIsAdding]     = useState(false);

  const hasVariants  = (product.variantOptions?.length ?? 0) > 0 && (product.variants?.length ?? 0) > 0;
  const needsVariant = hasVariants && !selectedVariant;

  const handleAddAsIs = async () => {
    if (needsVariant) return;
    setIsAdding(true);
    try {
      await addItem({
        productId:         product.id,
        variantId:         selectedVariant?.sku ?? null,
        quantity:          1,
        customizationData: null,
      });
      openDrawer();
    } finally {
      setIsAdding(false);
    }
  };

  const handleNotify = async () => {
    if (!notifyEmail.trim()) return;
    setNotifyState('loading');
    try {
      await apiClient.post(API_ROUTES.NOTIFICATIONS.PRODUCT_READY, {
        productId: product.id,
        email:     notifyEmail.trim(),
      });
      setNotifyState('success');
    } catch {
      setNotifyState('error');
    }
  };

  return (
    <div className="rounded-card border-2 border-dashed border-primary/30 bg-primary/3 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Palette className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-secondary text-base">
            {t('personalization.comingSoon')}
          </p>
          <p className="text-sm text-muted mt-0.5 leading-relaxed">
            We&apos;re working on making this product fully customizable.
            In the meantime, you can:
          </p>
        </div>
      </div>

      {/* Add as-is button */}
      <button
        type="button"
        onClick={handleAddAsIs}
        disabled={isAdding || needsVariant}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
      >
        {isAdding ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <ShoppingCart className="w-4 h-4" />
        )}
        {isAdding ? 'Adding…' : 'Add to Cart as-is'}
      </button>

      {/* Notify me section */}
      <div className="border-t border-primary/15 pt-4">
        {notifyState === 'success' ? (
          <p className="text-sm text-success font-medium text-center py-1">
            ✅ {t('personalization.notified')}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              {t('personalization.notifyMe')}
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNotify(); }}
                placeholder="your@email.com"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={handleNotify}
                disabled={!notifyEmail.trim() || notifyState === 'loading'}
                className="px-4 py-2 text-sm font-semibold border border-primary text-primary rounded-button hover:bg-primary/5 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {notifyState === 'loading' ? '…' : 'Notify me'}
              </button>
            </div>
            {notifyState === 'error' && (
              <p className="text-xs text-error">Something went wrong. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
