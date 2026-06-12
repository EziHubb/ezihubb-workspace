import { notFound } from 'next/navigation';
import Link from 'next/link';
import { differenceInMonths } from 'date-fns';
import { ArrowLeft, Mail, MapPin, Phone, Calendar } from 'lucide-react';
import { serverApi } from '../../../../lib/api-client';
import { fmtAmount, fmtCurrency, fmtDate, fmtDateTime } from '../../../../lib/fmt';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import {
  CustomerSideCards,
  type CustomerNote,
  type CustomerAddress,
} from './CustomerSideCards';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerDetail {
  id:          string;
  firstName?:  string;
  lastName?:   string;
  email:       string;
  phone?:      string;
  city?:       string;
  country?:    string;
  createdAt:   string;
  totalSpent:  number;
  ordersCount: number;
  avgOrderValue: number;
  returnsCount:  number;
  tags:        string[];
  notes:       CustomerNote[];
  addresses:   CustomerAddress[];
}

interface OrderSummary {
  id:        string;
  orderNumber: string;
  status:    string;
  total:     number;
  createdAt: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarXL({ firstName, lastName, email }: { firstName?: string; lastName?: string; email: string }) {
  const initials = ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || (email[0]?.toUpperCase() ?? '?');
  return (
    <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center mx-auto">
      <span className="text-2xl font-bold text-primary">{initials}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params:       { id: string };
  searchParams: { page?: string };
}) {
  const ordersPage = Number(searchParams.page ?? '1');

  let customer: CustomerDetail;
  let orders: { data: OrderSummary[]; total: number };

  try {
    [customer, orders] = await Promise.all([
      serverApi<CustomerDetail>('get', `/admin/customers/${params.id}`),
      serverApi<{ data: OrderSummary[]; total: number }>('get', `/admin/customers/${params.id}/orders?page=${ordersPage}&limit=10`),
    ]);
  } catch {
    notFound();
  }

  const fullName       = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
  const monthsAsCustomer = differenceInMonths(new Date(), new Date(customer.createdAt));
  const location       = [customer.city, customer.country].filter(Boolean).join(', ');

  const totalOrderPages = Math.ceil(orders.total / 10);

  return (
    <>
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-3 mb-2 text-sm text-muted">
        <Link href="/customers" className="hover:text-secondary transition-colors">Customers</Link>
        <span>/</span>
        <span className="text-secondary font-medium">{fullName}</span>
      </div>

      <AdminPageHeader
        title={fullName}
        subtitle={customer.email}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="flex items-center gap-1.5 text-sm font-medium text-muted border border-border rounded-button px-3 py-2 hover:border-primary/40 hover:text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Customers
            </Link>
            <a
              href={`mailto:${customer.email}`}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-2 hover:border-primary/40 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Send Email
            </a>
          </div>
        }
      />

      {/* 3-column grid */}
      <div className="grid grid-cols-[28%_1fr_28%] gap-5 items-start">

        {/* ── LEFT: Profile card ──────────────────────────────────────────── */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          {/* Avatar */}
          <div className="text-center mb-4">
            <AvatarXL
              firstName={customer.firstName}
              lastName={customer.lastName}
              email={customer.email}
            />
            <h4 className="font-semibold text-secondary mt-3 text-base">{fullName}</h4>
            <p className="text-sm text-muted mt-0.5">{customer.email}</p>
          </div>

          {/* Contact details */}
          <ul className="space-y-2 text-sm text-muted mb-4">
            {customer.phone && (
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {customer.phone}
              </li>
            )}
            {location && (
              <li className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {location}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              Joined {fmtDate(customer.createdAt)}
            </li>
          </ul>

          <p className="text-xs text-muted/70 text-center mb-4">
            Customer for {monthsAsCustomer < 1 ? 'less than a month' : `${monthsAsCustomer} month${monthsAsCustomer !== 1 ? 's' : ''}`}
          </p>

          {/* Divider */}
          <div className="border-t border-border my-4" />

          {/* Lifetime value */}
          <div className="text-center mb-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Lifetime Value</p>
            <p className="text-3xl font-bold text-primary tabular-nums">
              {fmtAmount(customer.totalSpent)}
            </p>
          </div>

          <div className="grid grid-cols-3 text-center gap-2 mt-3">
            {[
              { label: 'Orders',    value: customer.ordersCount },
              { label: 'Avg Order', value: fmtCurrency(customer.avgOrderValue, 0) },
              { label: 'Returns',   value: customer.returnsCount },
            ].map((s) => (
              <div key={s.label} className="bg-background rounded-button p-2">
                <p className="text-sm font-bold text-secondary">{s.value}</p>
                <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Order history ─────────────────────────────────────────── */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <h4 className="font-semibold text-secondary mb-4">
            Order History ({orders.total})
          </h4>

          {orders.data.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.data.map((order) => (
                <li key={order.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-mono font-semibold text-primary hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                      <OrderStatusBadge status={order.status} size="sm" />
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {fmtDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-secondary tabular-nums shrink-0">
                    {fmtAmount(order.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalOrderPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
              <p className="text-xs text-muted">Page {ordersPage} of {totalOrderPages}</p>
              <div className="flex items-center gap-1.5">
                {ordersPage > 1 && (
                  <Link
                    href={`/customers/${params.id}?page=${ordersPage - 1}`}
                    className="px-2.5 py-1 text-xs border border-border rounded-button hover:border-primary/40 text-muted transition-colors"
                  >
                    ← Prev
                  </Link>
                )}
                {ordersPage < totalOrderPages && (
                  <Link
                    href={`/customers/${params.id}?page=${ordersPage + 1}`}
                    className="px-2.5 py-1 text-xs border border-border rounded-button hover:border-primary/40 text-muted transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Notes, tags, addresses ─────────────────────────────────── */}
        <CustomerSideCards
          customerId={customer.id}
          notes={customer.notes}
          tags={customer.tags}
          addresses={customer.addresses}
        />
      </div>
    </>
  );
}
