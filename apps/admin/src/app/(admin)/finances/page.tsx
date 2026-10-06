'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAdminMode } from '../../../lib/store-context';
import { MoneyMode } from '../../../lib/economic-finances';
import { CapturedFinancePanel } from '../../../components/finances/CapturedFinancePanel';

export default function PaymentAccountPage() {
  const { data: session } = useSession();
  const { isReady, isPlatformContext, ownStoreId } = useAdminMode();
  const [mode, setMode] = useState<MoneyMode>('LIVE');
  const actorId = (session?.user as { id?: string } | undefined)?.id;
  if (!isReady) return <p role="status">Loading account…</p>;
  if (!actorId || !ownStoreId || isPlatformContext) return <p>Select your own store to view its payment account.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold text-secondary">Payment account</h1>
        <p className="mt-2 text-sm text-secondary">Verified money, exact allocations and payout history.</p></div>
      <label className="flex items-center gap-3 text-secondary" htmlFor="finance-mode">Environment
        <select id="finance-mode" className="min-h-11 rounded-button border border-border bg-surface px-3" value={mode} onChange={e => setMode(e.target.value as MoneyMode)}>
          <option value="LIVE">Live</option><option value="TEST">Test / sandbox</option>
        </select>
      </label>
    </div>
    <CapturedFinancePanel key={`${actorId}:${ownStoreId}:${mode}`} actorId={actorId} storeId={ownStoreId} mode={mode} />
    <aside className="border border-border rounded-card p-5 text-secondary space-y-3">
      <h2 className="text-lg font-semibold">Legacy records & account settings</h2>
      <p className="text-sm">Historical ledger entries are retained for reconciliation. They are not proof of collected funds and are not included in the available balance above.</p>
      <div className="flex flex-wrap gap-4">
        <Link className="underline py-2" href="/finances/statements">View legacy statements</Link>
        <Link className="underline py-2" href="/finances/payment-settings">Payment settings</Link>
      </div>
    </aside>
  </div>;
}
