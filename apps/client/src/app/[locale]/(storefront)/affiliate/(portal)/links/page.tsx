'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthQuery } from '../../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';
import { safeArr, safeNum } from '@ezihubb/utils';

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ezihubb.com';

interface ClickRow {
  id:          string;
  landingPage: string;
  convertedAt: string | null;
  orderId:     string | null;
  createdAt:   string;
}

interface ClicksResponse {
  data:       ClickRow[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// Fetch referral code from the dashboard cache (avoids a separate request)
interface DashboardData { referralCode: string }

function trunc(url: string, max = 55) {
  try { url = decodeURIComponent(url); } catch { /* keep raw */ }
  return url.length > max ? `…${url.slice(-max + 1)}` : url;
}

export default function AffiliateLinksPage() {
  const locale = useLocale();
  const t      = useTranslations('affiliate.links');

  const fmt     = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDate = (d: string) => fmt.format(new Date(d));

  const [baseInput, setBaseInput] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [page, setPage]           = useState(1);

  const { data: dashboard } = useAuthQuery<DashboardData>(
    ['affiliate-dashboard'],
    API_ROUTES.AFFILIATES.ME_DASHBOARD,
  );

  const { data: clicks, isLoading } = useAuthQuery<ClicksResponse>(
    ['affiliate-clicks', page],
    API_ROUTES.AFFILIATES.ME_CLICKS,
    { page, limit: 20 },
  );

  const referralCode = dashboard?.referralCode ?? '';
  const LIMIT        = 20;

  const buildLink = () => {
    const raw = baseInput.trim() || BASE_URL;
    try {
      const url = new URL(raw.startsWith('http') ? raw : `${BASE_URL}/${raw.replace(/^\//, '')}`);
      url.searchParams.set('ref', referralCode);
      return url.toString();
    } catch {
      return `${BASE_URL}?ref=${referralCode}`;
    }
  };

  const generatedLink = referralCode ? buildLink() : '';

  const copyTo = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>

      {/* ── Link generator ───────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5">
        <h2 className="font-semibold text-secondary text-sm mb-1">{t('generatorTitle')}</h2>
        <p className="text-xs text-muted mb-4">
          {t('generatorDesc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="url"
            value={baseInput}
            onChange={(e) => setBaseInput(e.target.value)}
            placeholder={`${BASE_URL}/products/my-product`}
            className="flex-1 min-w-0 border border-border rounded-button px-4 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        {generatedLink && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-button px-4 py-2.5">
            <span className="flex-1 min-w-0 text-sm font-mono text-green-800 truncate">{generatedLink}</span>
            <button
              type="button"
              onClick={() => copyTo(generatedLink)}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 shrink-0 transition-colors"
            >
              {copiedLink === generatedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink === generatedLink ? t('copied') : t('copy')}
            </button>
          </div>
        )}
      </div>

      {/* ── Click history ────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-sm">{t('historyTitle')}</h2>
          {clicks && (
            <span className="text-xs text-muted">
              {t('totalClicks', { count: safeNum(clicks.total) })}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : safeArr(clicks?.data).length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">
            {t('noClicks')}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{t('colDate')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{t('colLandingPage')}</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wide">{t('colConverted')}</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArr(clicks?.data).map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-background transition-colors">
                      <td className="px-5 py-3 text-muted whitespace-nowrap">
                        {fmtDate(row.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-muted max-w-xs">
                        <span title={row.landingPage}>{trunc(row.landingPage)}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {row.convertedAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ {t('orderPlaced')}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {clicks && clicks.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-button border border-border text-secondary disabled:opacity-40 hover:border-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted">
                  {t('pageOf', { page, total: clicks.totalPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(clicks.totalPages, p + 1))}
                  disabled={page >= clicks.totalPages}
                  className="p-1.5 rounded-button border border-border text-secondary disabled:opacity-40 hover:border-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick copy — homepage link */}
      {referralCode && (
        <div className="text-center text-sm text-muted">
          {t('baseLinkLabel')}{' '}
          <button
            type="button"
            onClick={() => copyTo(`${BASE_URL}?ref=${referralCode}`)}
            className="font-mono text-primary hover:underline"
          >
            {BASE_URL}?ref={referralCode}
          </button>
          {copiedLink === `${BASE_URL}?ref=${referralCode}` && (
            <span className="ml-2 text-green-600 text-xs">{t('copied')}</span>
          )}
        </div>
      )}
    </div>
  );
}
