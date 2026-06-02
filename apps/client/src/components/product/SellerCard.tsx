import { Star, Heart, MessageCircle, Package } from 'lucide-react';
import type { ProductDto } from '@mlh/types';

// ── Badge data ────────────────────────────────────────────────────────────────

const SELLER_BADGES = [
  {
    Icon:  Package,
    title: 'Smooth shipping',
    desc:  'Has a history of shipping on time with tracking',
  },
  {
    Icon:  MessageCircle,
    title: 'Speedy replies',
    desc:  'Has a history of replying to messages quickly',
  },
  {
    Icon:  Star,
    title: 'Rave reviews',
    desc:  'Average review rating is 4.8 or higher',
  },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface SellerCardProps {
  product: ProductDto;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SellerCard({ product }: SellerCardProps) {
  return (
    <section className="mt-12 pt-8 border-t border-border">

      {/* ── SELLER PROFILE ── */}
      <div className="flex items-start gap-4 mb-6">

        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
          ML
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-secondary">MapleLoomHandmade</h3>
            <span className="text-sm text-muted">United States</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              4.9
              {product.soldCount > 0 && (
                <span>({product.soldCount.toLocaleString()} sales)</span>
              )}
            </span>
            <span>Est. 2017 · MapleLoom</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-[#F3F4F6] transition-colors"
          >
            <Heart className="w-4 h-4" />
            Follow shop
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-[#F3F4F6] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Message seller
          </button>
        </div>
      </div>

      {/* ── SELLER BADGES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#FAFAF8] rounded-2xl">
        {SELLER_BADGES.map(({ Icon, title, desc }) => (
          <div key={title} className="text-center">
            <div className="w-10 h-10 rounded-full bg-white border border-border mx-auto flex items-center justify-center mb-2">
              <Icon className="w-5 h-5 text-secondary" />
            </div>
            <p className="text-xs font-semibold text-secondary">{title}</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

    </section>
  );
}
