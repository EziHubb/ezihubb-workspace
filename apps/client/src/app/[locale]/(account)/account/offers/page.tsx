'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { HandCoins, Check, X, Copy } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useToast } from '@ezihubb/ui';
import { fmtAmount } from '@ezihubb/utils';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';

// ── Types ─────────────────────────────────────────────────────────────────────

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COUNTERED';

interface BuyerOfferDto {
  id:            string;
  offeredPrice:  number;
  counterPrice:  number | null;
  status:        OfferStatus;
  expiresAt:     string;
  createdAt:     string;
  /**
   * Set only on an ACCEPTED offer. Accepting does not change the listing
   * price — it mints a single-use code scoped to this buyer and this product,
   * so without this the green "accepted" badge is all the buyer gets and the
   * code exists only in an email.
   */
  code:          string | null;
  codeExpiresAt: string | null;
  codeUsed:      boolean;
  product: {
    name:      string;
    slug:      string;
    basePrice: number;
    images:    { url: string }[];
  };
}

const STATUS_CLS: Record<OfferStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACCEPTED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
  EXPIRED:   'bg-gray-100 text-gray-600',
  COUNTERED: 'bg-blue-100 text-blue-700',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyOffersPage() {
  const t      = useTranslations('account.offers');
  const locale = useLocale();
  const toast  = useToast();

  const { data: offers = [], isLoading } = useAuthQuery<BuyerOfferDto[]>(
    ['my-offers'],
    API_ROUTES.OFFERS.MY,
  );

  const acceptMutation = useAuthMutation(
    (offerId: string, token: string) =>
      apiClient.post<{ status: string }>(API_ROUTES.OFFERS.ACCEPT_COUNTER(offerId), {}, { token }),
    {
      invalidateKeys: [['my-offers']],
      onSuccess:      () => toast.success(t('accept')),
    },
  );

  const rejectMutation = useAuthMutation(
    (offerId: string, token: string) =>
      apiClient.post<{ status: string }>(API_ROUTES.OFFERS.REJECT_COUNTER(offerId), {}, { token }),
    { invalidateKeys: [['my-offers']] },
  );

  const respondingId =
    (acceptMutation.isPending ? acceptMutation.variables : null) ??
    (rejectMutation.isPending ? rejectMutation.variables : null) ??
    null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-border rounded-card h-24" />
          ))}
        </div>
      )}

      {!isLoading && offers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <HandCoins className="w-14 h-14 text-muted/30" aria-hidden />
          <p className="text-sm text-muted">{t('empty')}</p>
        </div>
      )}

      {!isLoading && offers.length > 0 && (
        <div className="space-y-3">
          {offers.map((offer) => {
            const thumb = offer.product.images[0]?.url;
            const isBusy = respondingId === offer.id;
            return (
              <div key={offer.id} className="flex items-center gap-4 border border-border rounded-card p-4">
                <Link href={`/${locale}/products/${offer.product.slug}`} className="shrink-0">
                  {thumb ? (
                    <Image src={thumb} alt={offer.product.name} width={64} height={64} className="w-16 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-background" />
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link href={`/${locale}/products/${offer.product.slug}`} className="text-sm font-medium text-secondary hover:text-primary transition-colors line-clamp-1">
                    {offer.product.name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">{t('listedAt', { price: fmtAmount(offer.product.basePrice) })}</p>
                  <p className="text-xs text-secondary mt-0.5">{t('yourOffer', { price: fmtAmount(offer.offeredPrice) })}</p>
                  {offer.status === 'COUNTERED' && offer.counterPrice !== null && (
                    <p className="text-xs font-semibold text-blue-600 mt-0.5">{t('counterOffer', { price: fmtAmount(offer.counterPrice) })}</p>
                  )}
                  {(offer.status === 'PENDING' || offer.status === 'COUNTERED') && (
                    <p className="text-[11px] text-muted mt-0.5">{t('expires', { date: new Date(offer.expiresAt).toLocaleDateString(locale) })}</p>
                  )}

                  {/* The redeemable half of an accepted offer. Accepting does
                      not change the listing price — it mints a single-use code
                      scoped to this buyer and this product. It is emailed too,
                      but a filtered or deleted mail used to be the only copy,
                      which left an "accepted" offer with no way to redeem it. */}
                  {offer.status === 'ACCEPTED' && offer.code && (
                    <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          const code = offer.code;
                          if (code) navigator.clipboard?.writeText(code);
                        }}
                        title={t('copyCode')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-green-500 bg-green-50 text-[11px] font-mono font-semibold text-green-800 hover:bg-green-100 transition-colors"
                      >
                        {offer.code}
                        <Copy className="w-3 h-3" />
                      </button>
                      {offer.codeUsed ? (
                        <span className="text-[11px] text-muted">{t('codeUsed')}</span>
                      ) : offer.codeExpiresAt ? (
                        <span className="text-[11px] text-muted">
                          {t('codeExpires', { date: new Date(offer.codeExpiresAt).toLocaleDateString(locale) })}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                <span className={`text-xs font-semibold px-2.5 py-1 rounded-pill shrink-0 ${STATUS_CLS[offer.status]}`}>
                  {t(`status.${offer.status}`)}
                </span>

                {offer.status === 'COUNTERED' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => acceptMutation.mutate(offer.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-button transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> {t('accept')}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => rejectMutation.mutate(offer.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-border text-secondary text-xs font-semibold rounded-button hover:bg-background transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> {t('decline')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
