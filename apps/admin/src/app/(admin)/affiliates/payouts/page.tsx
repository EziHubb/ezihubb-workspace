'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAdminMode } from '../../../../lib/store-context';
import { PlatformCapturedFinances } from '../../../../components/finances/PlatformCapturedFinances';

type LegacyPayout = { id: string; amount: number | string; status: string; createdAt: string; adminNotes: string | null; affiliate: { firstName: string; lastName: string; email: string } };

export default function AffiliatePayoutsPage() {
  const { role, isPlatformContext } = useAdminMode();
  if (!role) return <p role="status">Loading account…</p>;
  if (role !== 'SUPER_ADMIN' || !isPlatformContext) return <p>Switch to platform context to review affiliate payouts.</p>;
  return <div className="space-y-6 text-secondary">
    <h1 className="text-2xl font-semibold">Verified affiliate balances & payouts</h1>
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
  if (result.isError) return <p role="alert">Legacy history could not be loaded. <button className="underline min-h-11" onClick={() => void result.refetch()}>Retry</button></p>;
  if (!result.data) return <p role="status">Loading legacy history…</p>;
  return <div className="space-y-4">
    {!result.data.data.length && <p>No legacy payouts.</p>}
    {result.data.data.map(row => <article key={row.id} className="border border-border rounded-card p-4 space-y-2 break-words">
      <h2 className="font-semibold">{row.id} · {String(row.amount)} USD · {row.status}</h2>
      <p>{row.affiliate.firstName} {row.affiliate.lastName} · {row.affiliate.email}</p>
      <p>{new Date(row.createdAt).toLocaleString()}</p>{row.adminNotes && <p>{row.adminNotes}</p>}
    </article>)}
    <div className="flex items-center gap-4"><button className="min-h-11 border border-border rounded-button px-4 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="min-h-11 border border-border rounded-button px-4 disabled:opacity-50" disabled={page >= result.data.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>
  </div>;
}
