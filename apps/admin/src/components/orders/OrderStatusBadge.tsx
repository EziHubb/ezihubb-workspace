const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:  { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED:        { label: 'Confirmed',        color: 'bg-blue-100 text-blue-800'   },
  IN_PRODUCTION:    { label: 'In Production',    color: 'bg-purple-100 text-purple-800'},
  SHIPPED:          { label: 'Shipped',           color: 'bg-cyan-100 text-cyan-800'   },
  DELIVERED:        { label: 'Delivered',         color: 'bg-teal-100 text-teal-800'   },
  COMPLETED:        { label: 'Completed',         color: 'bg-green-100 text-green-800' },
  CANCELLED:        { label: 'Cancelled',         color: 'bg-red-100 text-red-800'     },
  REFUND_REQUESTED: { label: 'Refund Requested',  color: 'bg-orange-100 text-orange-800'},
  REFUNDED:         { label: 'Refunded',          color: 'bg-gray-100 text-gray-700'   },
  DISPUTED:         { label: 'Disputed',          color: 'bg-red-50 text-red-600'      },
};

export const ALL_STATUSES = Object.keys(STATUS_CONFIG);

interface OrderStatusBadgeProps {
  status: string;
  size?:  'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const cfg  = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  const cls  = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-semibold rounded-pill ${cfg.color} ${cls} whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
}
