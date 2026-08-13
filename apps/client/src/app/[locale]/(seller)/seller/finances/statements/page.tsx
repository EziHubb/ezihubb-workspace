'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Landmark, Receipt, ArrowLeft, ArrowRight, Download } from 'lucide-react';
import { api, useFinancesActivitySummary, useFinancesActivities } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';
import { FinancesSubNav } from '../../../../../../components/seller/FinancesSubNav';
import { ActivitySummaryCard } from '../../../../../../components/seller/finances/ActivitySummaryCard';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

export default function MonthlyStatementPage() {
  const t = useTranslations('seller.finances.statements');
  const tType = useTranslations('seller.finances.ledgerType');
  const locale = useLocale();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)),
  );
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const { data: summary, isLoading: sumLoading } = useFinancesActivitySummary(month, year);
  const { data: activities, isLoading: actLoading } = useFinancesActivities(month, year, page, 25);

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await api.get<string>(API_ROUTES.SELLER.FINANCES_ACTIVITIES_EXPORT, { params: { month, year } });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${year}-${String(month).padStart(2, '0')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
        <span>{t('breadcrumbPaymentAccount')}</span>
        <span>/</span>
        <span>{t('breadcrumbMonthlyStatements')}</span>
        <span>/</span>
        <span className="text-secondary font-medium">{t('breadcrumbCurrent')}</span>
      </div>
      <h1 className="text-xl font-bold text-secondary mb-1">{t('title')}</h1>
      <FinancesSubNav />

      <div className="flex items-center gap-2 mb-5">
        <select
          value={month}
          onChange={(e) => handleMonthChange(Number(e.target.value), year)}
          className="text-sm font-medium border border-border rounded-full px-4 py-2 bg-surface text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {monthNames.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => handleMonthChange(month, Number(e.target.value))}
          className="text-sm font-medium border border-border rounded-full px-4 py-2 bg-surface text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {sumLoading || !summary ? (
        <Skeleton className="h-64 mb-8" />
      ) : (
        <div className="mb-8">
          <ActivitySummaryCard summary={summary} monthLabel={monthLabel} />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-secondary">{t('allActivities')}</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-secondary hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? t('generating') : t('generateCsv')}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40">
              <th className="w-8" />
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('table.date')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('table.type')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('table.description')}</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted text-xs">{t('table.net')}</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted text-xs">{t('table.balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-3 py-3"><Skeleton className="h-4" /></td></tr>
              ))
            ) : (activities?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">{t('noActivity')}</td></tr>
            ) : (
              (activities?.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-background/40 transition-colors">
                  <td className="pl-3">
                    {row.type === 'VAT'
                      ? <Landmark className="w-4 h-4 text-muted" />
                      : <Receipt className="w-4 h-4 text-muted" />}
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.date))}
                  </td>
                  <td className="px-3 py-3 text-secondary">{tType(row.type)}</td>
                  <td className="px-3 py-3 text-secondary max-w-xs truncate">{row.description}</td>
                  <td className={`px-3 py-3 text-right font-medium whitespace-nowrap ${row.amount < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(row.amount)}
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap ${row.balance < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(row.balance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activities && activities.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label={t('prevPage')}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-secondary px-2">{page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(activities.pagination.totalPages, p + 1))}
            disabled={page >= activities.pagination.totalPages}
            aria-label={t('nextPage')}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
