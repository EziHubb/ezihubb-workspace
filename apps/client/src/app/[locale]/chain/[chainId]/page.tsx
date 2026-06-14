'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Gift,
  ChevronRight,
  Loader2,
  AlertCircle,
  Check,
  Send,
  Copy,
  Share2,
  Link2,
  ArrowRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChainStage = 'SENT' | 'OPENED' | 'FORWARDED';

interface ChainLink {
  id:             string;
  stage:          ChainStage;
  senderEmail:    string;
  recipientEmail: string;
  forwardedAt:    string | null;
  openedAt:       string | null;
  sentAt:         string;
}

interface GiftChain {
  id:                 string;
  product: {
    id:        string;
    name:      string;
    slug:      string;
    imageUrl:  string | null;
    basePrice: number;
  };
  links:              ChainLink[];
  discountCode:       string | null;
  isCurrentRecipient: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const masked = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}`;
  return `${masked}@${domain}`;
}

function getInitials(email: string): string {
  const [user] = email.split('@');
  return user.slice(0, 2).toUpperCase();
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day:   'numeric',
  year:  'numeric',
});

const STAGE_COLORS: Record<ChainStage, string> = {
  SENT:      'bg-muted/10 text-muted border-border',
  OPENED:    'bg-blue-50 text-blue-700 border-blue-200',
  FORWARDED: 'bg-green-50 text-green-700 border-green-200',
};

const STAGE_ICONS: Record<ChainStage, React.ElementType> = {
  SENT:      Send,
  OPENED:    Gift,
  FORWARDED: ChevronRight,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GiftChainPage() {
  const params  = useParams<{ chainId: string }>();
  const chainId = params.chainId;
  const t       = useTranslations('giftChain');
  const user    = useAuthStore((s) => s.user);
  const token   = useAuthStore((s) => s.accessToken);

  const [chain,      setChain]      = useState<GiftChain | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchChain = useCallback(async () => {
    try {
      const data = await apiClient.get<GiftChain>(`/gift-chains/${chainId}`, {
        token: token ?? undefined,
      });
      setChain(data);
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, [chainId, token]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  const [nextEmail,    setNextEmail]    = useState('');
  const [forwarding,   setForwarding]   = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [forwarded,    setForwarded]    = useState(false);
  const [codeCopied,   setCodeCopied]   = useState(false);
  const [linkCopied,   setLinkCopied]   = useState(false);

  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextEmail.trim()) { setForwardError(t('emailRequired')); return; }
    setForwarding(true);
    setForwardError(null);
    try {
      await apiClient.post(
        `/gift-chains/${chainId}/forward`,
        { recipientEmail: nextEmail.trim() },
        { token: token ?? undefined },
      );
      setForwarded(true);
      await fetchChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('forwardError' as never);
      setForwardError(msg);
    } finally {
      setForwarding(false);
    }
  };

  const copyCode = () => {
    if (!chain?.discountCode) return;
    navigator.clipboard.writeText(chain.discountCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (fetchError || !chain) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="w-14 h-14 text-error/50" />
        <div>
          <p className="font-semibold text-secondary text-lg">{t('notFound')}</p>
          <p className="text-sm text-muted mt-1">{t('notFoundSub')}</p>
        </div>
      </div>
    );
  }

  const totalValue = chain.product.basePrice * chain.links.length;
  const startedDate = chain.links.length > 0 ? dateFmt.format(new Date(chain.links[0].sentAt)) : '—';
  const shareText = encodeURIComponent(`Someone sent you a gift! Check out this ${chain.product.name} chain: ${typeof window !== 'undefined' ? window.location.href : ''}`);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">

        {/* Hero section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            <Gift className="w-3.5 h-3.5" />
            A gift that keeps giving
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-secondary">
            The {chain.product.name} Chain
          </h1>
          <div className="flex items-center justify-center gap-6 text-sm text-muted pt-1">
            <div className="text-center">
              <p className="font-bold text-secondary text-base tabular-nums">{chain.links.length}</p>
              <p className="text-xs">Links</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="font-bold text-secondary text-base">{startedDate}</p>
              <p className="text-xs">Started</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="font-bold text-secondary text-base tabular-nums">${totalValue.toFixed(2)}</p>
              <p className="text-xs">Total value</p>
            </div>
          </div>
        </div>

        {/* Product header */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            {chain.product.imageUrl && (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-background">
                <Image
                  src={chain.product.imageUrl}
                  alt={chain.product.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-primary uppercase tracking-wide">{t('giftChainLabel')}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-secondary line-clamp-2">
                {chain.product.name}
              </h2>
              <p className="text-sm text-muted tabular-nums">${chain.product.basePrice.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Pay-it-forward banner */}
        {chain.isCurrentRecipient && chain.discountCode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Your 10% pay-it-forward discount is applied automatically</p>
            <p className="text-xs text-amber-600 mt-0.5">Valid for this order only</p>
          </div>
        )}

        {/* Discount code */}
        {chain.discountCode && user && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted">{t('yourDiscountCode')}</p>
              <p className="font-mono font-bold text-secondary text-base">{chain.discountCode}</p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 border border-border rounded-button px-3 py-1.5 text-xs font-medium text-secondary hover:border-primary hover:text-primary transition-colors shrink-0"
            >
              {codeCopied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {codeCopied ? t('copied') : t('copy')}
            </button>
          </div>
        )}

        {/* Chain visualization */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-4">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Chain journey
          </h2>

          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-0 min-w-max">
              {chain.links.map((link, idx) => (
                <div key={link.id} className="flex items-start">
                  <div className="flex flex-col items-center gap-2 w-24">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(link.senderEmail)}
                    </div>
                    <p className="text-[10px] font-semibold text-muted text-center">Link #{idx + 1}</p>
                    <p className="text-[10px] text-muted text-center break-all leading-tight">{maskEmail(link.senderEmail)}</p>
                    <p className="text-[10px] text-muted text-center">{dateFmt.format(new Date(link.sentAt))}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STAGE_COLORS[link.stage]}`}>
                      {link.stage}
                    </span>
                  </div>

                  <div className="flex items-center mt-5 px-1">
                    <div className="flex items-center gap-1 text-muted">
                      <div className="w-8 border-t border-dashed border-border" />
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col items-center gap-2 w-24">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-border text-muted flex items-center justify-center font-bold text-lg shrink-0">
                  ?
                </div>
                <p className="text-[10px] font-semibold text-muted text-center">Next link?</p>
                <p className="text-[10px] text-muted text-center leading-tight">Waiting for you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chain timeline */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-4">
          <h2 className="font-semibold text-secondary">{t('chainJourney')}</h2>

          <ol className="space-y-4">
            {chain.links.map((link, idx) => {
              const StageIcon = STAGE_ICONS[link.stage];
              const stageClass = STAGE_COLORS[link.stage];
              const isLast = idx === chain.links.length - 1;

              return (
                <li key={link.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${stageClass}`}>
                      <StageIcon className="w-3.5 h-3.5" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-border mt-1" aria-hidden />
                    )}
                  </div>

                  <div className="pb-4 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-medium text-secondary">{maskEmail(link.senderEmail)}</span>
                      <ChevronRight className="w-3 h-3 text-muted" />
                      <span className="font-medium text-secondary">{maskEmail(link.recipientEmail)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stageClass}`}>
                        {link.stage}
                      </span>
                      <span className="text-xs text-muted">
                        {dateFmt.format(new Date(link.sentAt))}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Forward form */}
        {chain.isCurrentRecipient && !forwarded && (
          <div className="bg-surface border border-border rounded-card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-secondary">{t('forwardTitle')}</h2>
              <p className="text-xs text-muted mt-0.5">{t('forwardSub')}</p>
            </div>

            <form onSubmit={handleForward} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('recipientEmail')}
                </label>
                <input
                  type="email"
                  required
                  value={nextEmail}
                  onChange={(e) => setNextEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {forwardError && <p className="text-xs text-error">{forwardError}</p>}

              <button
                type="submit"
                disabled={forwarding}
                className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wide rounded-button py-3 transition-colors flex items-center justify-center gap-2"
              >
                {forwarding && <Loader2 className="w-4 h-4 animate-spin" />}
                {forwarding ? t('forwarding') : t('forwardBtn')}
              </button>
            </form>
          </div>
        )}

        {forwarded && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
            <Check className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">{t('forwardedTitle')}</p>
              <p className="text-xs text-green-700">{t('forwardedSub')}</p>
            </div>
          </div>
        )}

        {/* Social share section */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Share this chain</h2>
          </div>
          <p className="text-xs text-muted">Spread the joy — share this gift chain with someone who deserves a surprise.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 border border-border rounded-button px-4 py-2 text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-button px-4 py-2 text-sm font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share on WhatsApp
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
