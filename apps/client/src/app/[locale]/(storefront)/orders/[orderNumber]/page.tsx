import type { Metadata } from 'next';
import { OrderDetailClient } from '../../../../../components/orders/OrderDetailClient';

export const dynamic = 'force-dynamic';

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string; locale: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order #${orderNumber}`,
    robots: { index: false, follow: false },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ orderNumber: string; locale: string }>;
  searchParams: Promise<{ verify?: string }>;
}) {
  const { orderNumber, locale } = await params;
  const { verify }              = await searchParams;

  return (
    <OrderDetailClient
      orderNumber={orderNumber}
      locale={locale}
      autoVerify={verify === '1'}
    />
  );
}
