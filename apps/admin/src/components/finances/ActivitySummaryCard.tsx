'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Wallet, CreditCard, Megaphone } from 'lucide-react';
import { fmtAmount } from '../../lib/fmt';
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-secondary">Activity summary</h2>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-secondary hover:border-primary/40 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Collapse categories' : 'Expand categories'}
        </button>
      </div>

      <p className="text-sm text-secondary mb-4">
        Your current{' '}
        <TooltipTerm tooltip="Your total Sales minus any deductions like refunds and your total Fees and Marketing costs for the selected time period.">
          net profit
        </TooltipTerm>{' '}
        on {monthLabel} is{' '}
        <span className={summary.netProfit < 0 ? 'text-error font-bold' : 'text-secondary font-bold'}>
          {fmtAmount(summary.netProfit)}
        </span>
      </p>

      <p className="text-sm font-semibold text-secondary mb-2">Sales and fees</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <CategoryCard
          icon={Wallet} iconBg="bg-success/10" iconColor="text-success"
          title="Sales" total={summary.sales.total} expanded={expanded}
          rows={[
            { label: `Total sales (${summary.sales.totalSalesCount})`, value: null },
            { label: 'Refunds (0)', value: null },
            { label: 'Sales tax paid by buyer (Remitted)', value: null, tooltip: 'Collected from the buyer and passed directly to tax authorities — not deducted from your earnings.' },
            { label: 'VAT paid by buyer (Remitted)', value: null, tooltip: 'Collected from the buyer and passed directly to tax authorities — not deducted from your earnings.' },
          ]}
        />
        <CategoryCard
          icon={CreditCard} iconBg="bg-error/10" iconColor="text-error"
          title="Fees" total={summary.fees.total} expanded={expanded}
          rows={[
            { label: 'Listing fees', value: summary.fees.listingFees || null, tooltip: 'A flat fee charged each time you publish a listing.' },
            { label: 'Transaction fees', value: summary.fees.transactionFees || null, tooltip: 'A percentage of the order subtotal and shipping, charged on each sale.' },
            { label: 'Processing fees', value: summary.fees.processingFees || null, tooltip: 'A percentage plus a fixed fee to process each payment.' },
            { label: 'Regulatory Operating fee', value: summary.fees.regulatoryFee || null, tooltip: 'An additional fee applied in certain regions to cover regulatory costs.' },
            { label: 'Deposit fees', value: summary.fees.depositFees || null, tooltip: 'A fee that may apply to certain international bank deposits.' },
            { label: 'VAT on seller fees', value: summary.fees.vatOnFees || null, tooltip: 'Value-added tax charged on top of your other platform fees.' },
          ]}
        />
      </div>

      <p className="text-sm font-semibold text-secondary mb-2">Seller services</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CategoryCard
          icon={Megaphone} iconBg="bg-primary/10" iconColor="text-primary"
          title="Marketing" total={summary.marketing.total} expanded={expanded}
          rows={[
            { label: 'Platform Ads', value: null },
            { label: 'Offsite Ads', value: null },
          ]}
        />
      </div>
    </div>
  );
}
