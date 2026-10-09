'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Pagination } from '@ezihubb/ui';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { useAdminMode } from '../../../../lib/store-context';
import { PlatformCapturedFinances } from '../../../../components/finances/PlatformCapturedFinances';
import { FINANCE_REPORT_QUERY_KEYS } from '../../../../lib/finance-query-keys';

type LegacyPayout = { id: string; amount: number | string; status: string; createdAt: string; adminNotes: string | null; affiliate: { firstName: string; lastName: string; email: string } };

export default function AffiliatePayoutsPage() {
  const { role, isPlatformContext } = useAdminMode();
  if (!role) return <p role="status">Loading account…</p>;
  if (role !== 'SUPER_ADMIN' || !isPlatformContext) return <p>Switch to platform context to review affiliate payouts.</p>;
  return <div className="space-y-6 text-secondary">
    <AdminPageHeader title="Verified affiliate balances & payouts" subtitle="Review verified funds and settlement evidence" queryKeys={FINANCE_REPORT_QUERY_KEYS} />
    <PlatformCapturedFinances initialKind="AFFILIATE" />
    <details className="border border-border rounded-card p-5">
      <summary className="py-2 font-semibold cursor-pointer">Legacy affiliate payouts — reconciliation only</summary>
      <p className="my-4">Historical labels are retained, not verified provider evidence. Legacy requests cannot be paid, rejected or added to captured funds from this view.</p>
      <LegacyHistory />
    </details>
  </div>;
}

function LegacyHistory() {
  const [page, setPage] = useState(1);
  const result = useQuery({ queryKey: ['admin-affiliate-payouts', 'legacy', page], queryFn: () => api.get<{ data: LegacyPayout[]; totalPages: number }>('/admin/affiliates/payouts', { params: { page, limit: 20 } }), retry: false });
  if (result.isError) return <div role="alert" className="space-y-3"><p>Legacy history could not be loaded.</p><Button type="button" variant="secondary" onClick={() => void result.refetch()}>Retry</Button></div>;
  if (!result.data) return <p role="status">Loading legacy history…</p>;
  return <div className="space-y-4">
    {!result.data.data.length && <p>No legacy payouts.</p>}
    {result.data.data.map(row => <article key={row.id} className="border border-border rounded-card p-4 space-y-2 break-words">
      <h2 className="font-semibold">{row.id} · {String(row.amount)} USD · {row.status}</h2>
      <p>{row.affiliate.firstName} {row.affiliate.lastName} · {row.affiliate.email}</p>
      <p>{new Date(row.createdAt).toLocaleString()}</p>{row.adminNotes && <p>{row.adminNotes}</p>}
    </article>)}
    <Pagination page={page} totalPages={result.data.totalPages} onPageChange={setPage} />
  </div>;
}
