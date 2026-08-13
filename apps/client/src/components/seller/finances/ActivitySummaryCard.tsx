'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Wallet, CreditCard, Megaphone } from 'lucide-react';
import { fmtAmount } from '@ezihubb/utils';
import type { FinancesActivitySummaryDto } from '@ezihubb/types';
import { InfoTooltip, TooltipTerm } from './InfoTooltip';

function CategoryCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  total,
  expanded,
  rows,
}: {
  icon:      React.ElementType;
  iconBg:    string;
  iconColor: string;
  title:     string;
  total:     number;
  expanded:  boolean;
  rows:      { label: string; value: number | null; tooltip?: string; indent?: boolean }[];
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </span>
          {title}
        </span>
        <span className={`text-sm font-bold ${total < 0 ? 'text-error' : 'text-secondary'}`}>
          {fmtAmount(total)}
        </span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {rows.map((row) => (
            <div key={row.label} className={`flex items-center justify-between text-xs ${row.indent ? 'pl-4' : ''}`}>
              <span className="flex items-center gap-1 text-muted">
                {row.label}
                {row.tooltip && <InfoTooltip>{row.tooltip}</InfoTooltip>}
              </span>
              <span className={row.value != null && row.value < 0 ? 'text-error' : 'text-secondary'}>
                {row.value == null ? '--' : fmtAmount(row.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivitySummaryCard({
  summary,
  monthLabel,
}: {
  summary:    FinancesActivitySummaryDto;
  monthLabel: string;
}) {
  const t = useTranslations('seller.finances.activitySummary');
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-secondary">{t('title')}</h2>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-secondary hover:border-primary/40 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? t('collapseCategories') : t('expandCategories')}
        </button>
      </div>

      <p className="text-sm text-secondary mb-4">
        {t.rich('netProfitText', {
          month:  monthLabel,
          amount: fmtAmount(summary.netProfit),
          np:  (chunks) => <TooltipTerm tooltip={t('netProfitTooltip')}>{chunks}</TooltipTerm>,
          amt: (chunks) => (
            <span className={summary.netProfit < 0 ? 'text-error font-bold' : 'text-secondary font-bold'}>
              {chunks}
            </span>
          ),
        })}
      </p>

      <p className="text-sm font-semibold text-secondary mb-2">{t('salesAndFees')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <CategoryCard
          icon={Wallet} iconBg="bg-success/10" iconColor="text-success"
          title={t('sales')} total={summary.sales.total} expanded={expanded}
          rows={[
            { label: t('totalSales', { count: summary.sales.totalSalesCount }), value: null },
            { label: t('refunds', { count: 0 }), value: null },
            { label: t('salesTaxRemitted'), value: null, tooltip: t('remittedTooltip') },
            { label: t('vatRemitted'), value: null, tooltip: t('remittedTooltip') },
          ]}
        />
        <CategoryCard
          icon={CreditCard} iconBg="bg-error/10" iconColor="text-error"
          title={t('fees')} total={summary.fees.total} expanded={expanded}
          rows={[
            { label: t('listingFees'), value: summary.fees.listingFees || null, tooltip: t('listingFeesTooltip') },
            { label: t('transactionFees'), value: summary.fees.transactionFees || null, tooltip: t('transactionFeesTooltip') },
            { label: t('processingFees'), value: summary.fees.processingFees || null, tooltip: t('processingFeesTooltip') },
            { label: t('regulatoryFee'), value: summary.fees.regulatoryFee || null, tooltip: t('regulatoryFeeTooltip') },
            { label: t('depositFees'), value: summary.fees.depositFees || null, tooltip: t('depositFeesTooltip') },
            { label: t('vatOnFees'), value: summary.fees.vatOnFees || null, tooltip: t('vatOnFeesTooltip') },
          ]}
        />
      </div>

      <p className="text-sm font-semibold text-secondary mb-2">{t('sellerServices')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CategoryCard
          icon={Megaphone} iconBg="bg-primary/10" iconColor="text-primary"
          title={t('marketing')} total={summary.marketing.total} expanded={expanded}
          rows={[
            { label: t('platformAds'), value: null },
            { label: t('offsiteAds'), value: null },
          ]}
        />
      </div>
    </div>
  );
}
