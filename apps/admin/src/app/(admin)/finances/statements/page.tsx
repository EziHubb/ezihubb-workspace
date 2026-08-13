'use client';

import { useState } from 'react';
import { Landmark, Receipt, ArrowLeft, ArrowRight, Download } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useFinancesActivitySummary, useFinancesActivities } from '../../../../lib/useFinances';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../lib/fmt';
import { ActivitySummaryCard } from '../../../../components/finances/ActivitySummaryCard';
import { LEDGER_TYPE_LABEL } from '../../../../components/finances/ledgerTypeLabel';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

export default function MonthlyStatementPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2000, i, 1)),
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
      const csv = await api.get<string>(API_ROUTES.ADMIN.FINANCES_ACTIVITIES_EXPORT, { params: { month, year } });
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
        <span>Payment account</span>
        <span>/</span>
        <span>Monthly statements</span>
        <span>/</span>
        <span className="text-secondary font-medium">Monthly statement</span>
      </div>
      <h1 className="text-xl font-bold text-secondary mb-6">Monthly statement</h1>

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
        <h2 className="text-base font-bold text-secondary">All activities</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-secondary hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Generating…' : 'Generate CSV'}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40">
              <th className="w-8" />
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">Date</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">Type</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">Description</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted text-xs">Net</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted text-xs">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-3 py-3"><Skeleton className="h-4" /></td></tr>
              ))
            ) : (activities?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No activity for this period.</td></tr>
            ) : (
              (activities?.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-background/40 transition-colors">
                  <td className="pl-3">
                    {row.type === 'VAT'
                      ? <Landmark className="w-4 h-4 text-muted" />
                      : <Receipt className="w-4 h-4 text-muted" />}
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">
                    {new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.date))}
                  </td>
                  <td className="px-3 py-3 text-secondary">{LEDGER_TYPE_LABEL[row.type] ?? row.type}</td>
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
            aria-label="Previous page"
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-secondary px-2">{page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(activities.pagination.totalPages, p + 1))}
            disabled={page >= activities.pagination.totalPages}
            aria-label="Next page"
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
