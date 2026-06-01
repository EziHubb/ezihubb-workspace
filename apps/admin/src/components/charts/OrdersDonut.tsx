'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderStatusDataPoint {
  status: string;
  count:  number;
  color?: string;
}

// ── Status color map ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#F59E0B',
  CONFIRMED:       '#3B82F6',
  IN_PRODUCTION:   '#8B5CF6',
  SHIPPED:         '#06B6D4',
  DELIVERED:       '#10B981',
  COMPLETED:       '#2E7D52',
  CANCELLED:       '#EF4444',
  REFUNDED:        '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending',
  CONFIRMED:       'Confirmed',
  IN_PRODUCTION:   'In Production',
  SHIPPED:         'Shipped',
  DELIVERED:       'Delivered',
  COMPLETED:       'Completed',
  CANCELLED:       'Cancelled',
  REFUNDED:        'Refunded',
};

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?:  boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-floating text-sm">
      <p className="font-semibold text-secondary">{STATUS_LABELS[payload[0].name] ?? payload[0].name}</p>
      <p className="text-muted">{payload[0].value} orders</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface OrdersDonutProps {
  data: OrderStatusDataPoint[];
}

export function OrdersDonut({ data }: OrdersDonutProps) {
  const total   = data.reduce((s, d) => s + d.count, 0);
  const entries = data.map((d) => ({
    ...d,
    color: d.color ?? STATUS_COLORS[d.status] ?? '#9CA3AF',
  }));

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-5">
      <h5 className="font-semibold text-secondary text-sm mb-4">Orders by Status</h5>

      {/* Donut + center label */}
      <div className="relative flex justify-center">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={entries}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {entries.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-secondary leading-none">{total}</span>
          <span className="text-xs text-muted mt-0.5">orders</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-4 space-y-1.5">
        {entries.map((entry) => {
          const pct = total > 0 ? ((entry.count / total) * 100).toFixed(0) : '0';
          return (
            <li key={entry.status} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: entry.color }}
              />
              <span className="flex-1 text-muted truncate">
                {STATUS_LABELS[entry.status] ?? entry.status}
              </span>
              <span className="font-medium text-secondary tabular-nums">{entry.count}</span>
              <span className="text-muted tabular-nums w-7 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
