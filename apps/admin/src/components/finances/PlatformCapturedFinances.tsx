'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { BeneficiaryKind, MoneyMode } from '../../lib/economic-finances';
import { CapturedFinancePanel } from './CapturedFinancePanel';
import { EconomicReconciliationPanel } from './EconomicReconciliationPanel';
import { EconomicSummaryPanel } from './EconomicSummaryPanel';
import { EconomicRecoveryPanel } from './EconomicRecoveryPanel';
import { EconomicExternalEffectsPanel } from './EconomicExternalEffectsPanel';

export function PlatformCapturedFinances({ initialKind = 'SELLER' }: { initialKind?: BeneficiaryKind } = {}) {
  const { data: session } = useSession();
  const [kind, setKind] = useState<BeneficiaryKind>(initialKind), [beneficiaryId, setBeneficiaryId] = useState('');
  const [mode, setMode] = useState<MoneyMode>('LIVE');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [selected, setSelected] = useState<{ kind: BeneficiaryKind; beneficiaryId: string; mode: MoneyMode } | null>(null);
  const actorId = (session?.user as { id?: string } | undefined)?.id;
  const input = 'min-h-11 border border-border rounded-button bg-surface px-3 text-secondary';
  return <div className="space-y-6">
    <button type="button" className={`${input} font-semibold`} aria-expanded={showExternal} aria-controls="platform-external-effects"
      onClick={() => setShowExternal(value => !value)}>{showExternal ? 'Hide external-effect reconciliation' : 'Review POD and notifications'}</button>
    <div id="platform-external-effects">{showExternal && actorId && <EconomicExternalEffectsPanel key={actorId} actorId={actorId} />}</div>
    <button type="button" className={`${input} font-semibold`} aria-expanded={showRecovery} aria-controls="platform-lifecycle-recovery"
      onClick={() => setShowRecovery(value => !value)}>
      {showRecovery ? 'Hide lifecycle recovery' : 'Review lifecycle recovery records'}
    </button>
    <div id="platform-lifecycle-recovery">
      {showRecovery && actorId && <EconomicRecoveryPanel key={actorId} actorId={actorId} />}
    </div>
    <button type="button" className={`${input} font-semibold`} aria-expanded={showSummary} aria-controls="platform-verified-summary"
      onClick={() => setShowSummary(value => !value)}>
      {showSummary ? 'Hide verified money totals' : 'Review verified money totals'}
    </button>
    <div id="platform-verified-summary">
      {showSummary && actorId && <EconomicSummaryPanel key={actorId} actorId={actorId} />}
    </div>
    <button type="button" className={`${input} font-semibold`} aria-expanded={showReconciliation} aria-controls="platform-reconciliation"
      onClick={() => setShowReconciliation(value => !value)}>
      {showReconciliation ? 'Hide payment reconciliation' : 'Review payment reconciliation'}
    </button>
    <div id="platform-reconciliation">
      {showReconciliation && actorId && <EconomicReconciliationPanel key={actorId} actorId={actorId} />}
    </div>
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
