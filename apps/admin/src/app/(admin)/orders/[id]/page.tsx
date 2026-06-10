import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { serverApi } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import type { OrderDetail } from '../../../../components/orders/OrderDrawer';
import { OrderDetailContent } from './OrderDetailContent';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Order ${id} — Maple Admin` };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: OrderDetail | null = null;
  try {
    order = await serverApi<OrderDetail>('get', API_ROUTES.ADMIN.ORDER(id));
  } catch {
    notFound();
  }

  const customerName = [order.customer.firstName, order.customer.lastName]
    .filter(Boolean).join(' ') || order.customer.email;

  return (
    <>
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-secondary mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      <AdminPageHeader
        title={`Order #${order.orderNumber}`}
        subtitle={`${customerName} · ${format(new Date(order.createdAt), 'MMM d, yyyy')} · $${Number(order.total).toFixed(2)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />

      <OrderDetailContent order={order} />
    </>
  );
}
