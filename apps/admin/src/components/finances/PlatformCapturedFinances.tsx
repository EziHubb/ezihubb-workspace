'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { BeneficiaryKind, MoneyMode } from '../../lib/economic-finances';
import { CapturedFinancePanel } from './CapturedFinancePanel';

export function PlatformCapturedFinances({ initialKind = 'SELLER' }: { initialKind?: BeneficiaryKind } = {}) {
  const { data: session } = useSession();
  const [kind, setKind] = useState<BeneficiaryKind>(initialKind), [beneficiaryId, setBeneficiaryId] = useState('');
  const [mode, setMode] = useState<MoneyMode>('LIVE');
  const [selected, setSelected] = useState<{ kind: BeneficiaryKind; beneficiaryId: string; mode: MoneyMode } | null>(null);
  const actorId = (session?.user as { id?: string } | undefined)?.id;
  const input = 'min-h-11 border border-border rounded-button bg-surface px-3 text-secondary';
  return <div className="space-y-6">
    <form className="flex flex-col sm:flex-row sm:items-end flex-wrap gap-4" onSubmit={e => { e.preventDefault(); if (beneficiaryId.trim()) setSelected({ kind, beneficiaryId: beneficiaryId.trim(), mode }); }}>
      <label className="flex flex-col gap-2" htmlFor="beneficiary-kind">Account type
        <select id="beneficiary-kind" className={input} value={kind} onChange={e => setKind(e.target.value as BeneficiaryKind)}><option value="SELLER">Seller</option><option value="AFFILIATE">Affiliate</option></select>
      </label>
      <label className="flex flex-col gap-2" htmlFor="beneficiary-id">{kind === 'SELLER' ? 'Store ID' : 'Affiliate account ID'}
        <input id="beneficiary-id" className={input} value={beneficiaryId} onChange={e => setBeneficiaryId(e.target.value)} required maxLength={150} />
      </label>
      <label className="flex flex-col gap-2" htmlFor="platform-finance-mode">Environment
        <select id="platform-finance-mode" className={input} value={mode} onChange={e => setMode(e.target.value as MoneyMode)}><option value="LIVE">Live</option><option value="TEST">Test / sandbox</option></select>
      </label>
      <button className={`${input} font-semibold`} disabled={!actorId || !beneficiaryId.trim()}>View verified account</button>
    </form>
    {selected && actorId ? <div className="space-y-4">
      <h2 className="font-semibold text-secondary break-words">{selected.kind} account: {selected.beneficiaryId}</h2>
      <CapturedFinancePanel key={`${actorId}:${selected.kind}:${selected.beneficiaryId}:${selected.mode}`} actorId={actorId} storeId="platform"
        platform={{ kind: selected.kind, beneficiaryId: selected.beneficiaryId }} mode={selected.mode} />
    </div> : <p className="text-secondary">Choose an account to inspect captured funds, exact payout allocations and provider settlement evidence. Accounts and test/live funds are never combined.</p>}
  </div>;
}
