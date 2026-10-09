'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Select } from '@ezihubb/ui';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
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
    <AdminPageHeader title="Payment account" subtitle="Verified money, exact allocations and payout history."
      queryKey={['captured-finances', actorId, ownStoreId, 'SELLER', ownStoreId, mode]}
      actions={<label className="flex items-center gap-3 text-sm text-secondary" htmlFor="finance-mode">Environment
        <Select id="finance-mode" value={mode} onChange={e => setMode(e.target.value as MoneyMode)} options={[{ value: 'LIVE', label: 'Live' }, { value: 'TEST', label: 'Test / sandbox' }]} />
      </label>} />
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
