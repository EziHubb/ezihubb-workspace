export enum OrderStatus {
  PENDING_PAYMENT  = 'PENDING_PAYMENT',
  CONFIRMED        = 'CONFIRMED',
  IN_PRODUCTION    = 'IN_PRODUCTION',
  SHIPPED          = 'SHIPPED',
  DELIVERED        = 'DELIVERED',
  COMPLETED        = 'COMPLETED',
  CANCELLED        = 'CANCELLED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUNDED         = 'REFUNDED',
  DISPUTED         = 'DISPUTED',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]:  'Pending Payment',
  [OrderStatus.CONFIRMED]:        'Confirmed',
  [OrderStatus.IN_PRODUCTION]:    'In Production',
  [OrderStatus.SHIPPED]:          'Shipped',
  [OrderStatus.DELIVERED]:        'Delivered',
  [OrderStatus.COMPLETED]:        'Completed',
  [OrderStatus.CANCELLED]:        'Cancelled',
  [OrderStatus.REFUND_REQUESTED]: 'Refund Requested',
  [OrderStatus.REFUNDED]:         'Refunded',
  [OrderStatus.DISPUTED]:         'Disputed',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  [OrderStatus.PENDING_PAYMENT]:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
  [OrderStatus.CONFIRMED]:        { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'   },
  [OrderStatus.IN_PRODUCTION]:    { bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200' },
  [OrderStatus.SHIPPED]:          { bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200'   },
  [OrderStatus.DELIVERED]:        { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200'},
  [OrderStatus.COMPLETED]:        { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200'  },
  [OrderStatus.CANCELLED]:        { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200'   },
  [OrderStatus.REFUND_REQUESTED]: { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
  [OrderStatus.REFUNDED]:         { bg: 'bg-gray-100',   text: 'text-gray-400',   border: 'border-gray-200'   },
  [OrderStatus.DISPUTED]:         { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'    },
};

export const CANCELLABLE_STATUSES = [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED];
export const CANCEL_WINDOW_HOURS  = 2;
