'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '../../lib/store/auth.store';
import { useAuthQuery } from '../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';

// ── Social helpers ─────────────────────────────────────────────────────────────

function buildSocialLinks(url: string, productName: string) {
  const encoded = encodeURIComponent(url);
  const text    = encodeURIComponent(`Check out "${productName}" — I think you'll love it!`);
  return {
    whatsapp:  `https://wa.me/?text=${text}%20${encoded}`,
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encoded}&description=${text}`,
    twitter:   `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ShareButtonProps {
  productSlug: string;
  productName: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShareButton({ productSlug, productName }: ShareButtonProps) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef          = useRef<HTMLDivElement>(null);

  const user      = useAuthStore((s) => s.user);
  const isLoggedIn = !!user;

  // Fetch referralCode from the referrals API (only when logged in)
  const { data: referralMe } = useAuthQuery<{ referralCode: string }>(
    ['referral-me-code'],
    API_ROUTES.REFERRALS.ME,
    undefined,
    { enabled: isLoggedIn, staleTime: 300_000 },
  );
  const referralCode = referralMe?.referralCode;

  // ── Locale from URL params ─────────────────────────────────────────────────
  const params = useParams() as Record<string, string | string[]>;
  const locale = (Array.isArray(params['locale']) ? params['locale'][0] : params['locale']) ?? 'en';

  // ── Share URL construction ────────────────────────────────────────────────
  const buildShareUrl = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/${locale}/products/${productSlug}`;
    return referralCode ? `${base}?ref=${referralCode}` : base;
  }, [locale, productSlug, referralCode]);

  // ── Mobile native share ───────────────────────────────────────────────────
  const handleShareButtonClick = async () => {
    const url = buildShareUrl();
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({ title: productName, url });
        return; // native share handled — don't open popover
      } catch {
        // user cancelled or not supported — fall through to popover
      }
    }
    setOpen((o) => !o);
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select + execCommand
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const shareUrl = buildShareUrl();
  const social   = buildSocialLinks(shareUrl, productName);

  return (
    <div className="relative" ref={popoverRef}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={handleShareButtonClick}
        aria-label="Share this product"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border rounded-full text-muted hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {/* ── Popover ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-border rounded-2xl shadow-xl w-[300px] p-4 space-y-3">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-secondary">Share this product</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-muted/10 text-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* URL + copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 bg-muted/5 border border-border rounded-lg">
              <p className="text-xs text-muted truncate font-mono">{shareUrl}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={[
                'shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border transition-colors',
                copied
                  ? 'bg-green-50 border-green-300 text-green-600'
                  : 'border-border text-muted hover:border-primary/40 hover:text-primary',
              ].join(' ')}
              title={copied ? 'Copied!' : 'Copy link'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Social links */}
          <div className="grid grid-cols-4 gap-1">
            {([
              {
                href:  social.whatsapp,
                label: 'WhatsApp',
                bg:    '#25D366',
                title: 'Share on WhatsApp',
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                ),
              },
              {
                href:  social.facebook,
                label: 'Facebook',
                bg:    '#1877F2',
                title: 'Share on Facebook',
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                    <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0011.393 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H4.59v3.209h2.681v8.202h6.126z"/>
                  </svg>
                ),
              },
              {
                href:  social.pinterest,
                label: 'Pinterest',
                bg:    '#E60023',
                title: 'Save to Pinterest',
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                ),
              },
              {
                href:  social.twitter,
                label: 'Twitter',
                bg:    '#000000',
                title: 'Share on X (Twitter)',
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ),
              },
            ] as const).map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 py-2 rounded-xl hover:bg-muted/5 transition-colors"
                title={s.title}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: s.bg }}
                >
                  {s.icon}
                </div>
                <span className="text-[10px] text-muted leading-tight">{s.label}</span>
              </a>
            ))}
          </div>

          {/* Commission CTA */}
          {isLoggedIn && referralCode ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-green-700 font-medium leading-tight">
                You&apos;ll earn commission when someone buys through your link!
              </p>
            </div>
          ) : !isLoggedIn ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
              <Share2 className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-secondary leading-tight">
                <Link href="/login" className="text-primary font-semibold hover:underline" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                {' '}to earn referral commission on every sale.
              </p>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}
