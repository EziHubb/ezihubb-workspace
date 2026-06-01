'use client';

import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { clientFetch } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  date:    string;  // ISO date string
  revenue: number;
}

interface RevenueChartProps {
  initialData:  RevenueDataPoint[];
  initialTotal: number;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?:  boolean;
  payload?: { value: number }[];
  label?:   string;
}) {
  if (!active || !payload?.length || !label) return null;
  const date = (() => { try { return format(parseISO(label), 'MMM d, yyyy'); } catch { return label; } })();
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-floating text-sm">
      <p className="text-muted mb-0.5">{date}</p>
      <p className="font-bold text-secondary">
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ── Date range tabs ────────────────────────────────────────────────────────────

const RANGES = [
  { label: '7D',  days: 7   },
  { label: '30D', days: 30  },
  { label: '90D', days: 90  },
] as const;

type Range = typeof RANGES[number]['label'];

// ── Component ─────────────────────────────────────────────────────────────────

export function RevenueChart({ initialData, initialTotal }: RevenueChartProps) {
  const [range,   setRange]   = useState<Range>('30D');
  const [data,    setData]    = useState<RevenueDataPoint[]>(initialData);
  const [total,   setTotal]   = useState<number>(initialTotal);
  const [loading, setLoading] = useState(false);

  const handleRangeChange = async (r: Range) => {
    if (r === range) return;
    setRange(r);
    setLoading(true);
    try {
      const days  = RANGES.find((x) => x.label === r)!.days;
      const res   = await clientFetch(`/admin/dashboard/revenue?days=${days}`);
      const body  = await res.json();
      const newData  = body.data?.data  ?? body.data ?? [];
      const newTotal = body.data?.total ?? body.total ?? 0;
      setData(newData);
      setTotal(newTotal);
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false);
    }
  };

  const formatXAxis = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'MMM d'); } catch { return dateStr; }
  };

  const formatYAxis = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v}`;
  };

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h5 className="font-semibold text-secondary text-sm">Revenue</h5>
          <p className="text-xs text-muted mt-0.5">Last {RANGES.find((r2) => r2.label === range)!.days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-primary font-bold text-sm">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 0 })} total
          </span>
          {/* Range selector */}
          <div className="flex bg-background rounded-button p-0.5 gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => handleRangeChange(r.label)}
                className={[
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  range === r.label
                    ? 'bg-surface text-secondary shadow-card'
                    : 'text-muted hover:text-secondary',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className={`transition-opacity ${loading ? 'opacity-40' : 'opacity-100'}`}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E85D3F" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#E85D3F" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#E85D3F"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#E85D3F', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
