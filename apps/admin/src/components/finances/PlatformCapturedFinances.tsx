'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Input, Select } from '@ezihubb/ui';
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
  return <div className="space-y-6">
    <Button type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal text-left" aria-expanded={showExternal} aria-controls="platform-external-effects"
      onClick={() => setShowExternal(value => !value)}>{showExternal ? 'Hide external-effect reconciliation' : 'Review POD and notifications'}</Button>
    <div id="platform-external-effects">{showExternal && actorId && <EconomicExternalEffectsPanel key={actorId} actorId={actorId} />}</div>
    <Button type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal text-left" aria-expanded={showRecovery} aria-controls="platform-lifecycle-recovery"
      onClick={() => setShowRecovery(value => !value)}>
      {showRecovery ? 'Hide lifecycle recovery' : 'Review lifecycle recovery records'}
    </Button>
    <div id="platform-lifecycle-recovery">
      {showRecovery && actorId && <EconomicRecoveryPanel key={actorId} actorId={actorId} />}
    </div>
    <Button type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal text-left" aria-expanded={showSummary} aria-controls="platform-verified-summary"
      onClick={() => setShowSummary(value => !value)}>
      {showSummary ? 'Hide verified money totals' : 'Review verified money totals'}
    </Button>
    <div id="platform-verified-summary">
      {showSummary && actorId && <EconomicSummaryPanel key={actorId} actorId={actorId} />}
    </div>
    <Button type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal text-left" aria-expanded={showReconciliation} aria-controls="platform-reconciliation"
      onClick={() => setShowReconciliation(value => !value)}>
      {showReconciliation ? 'Hide payment reconciliation' : 'Review payment reconciliation'}
    </Button>
    <div id="platform-reconciliation">
      {showReconciliation && actorId && <EconomicReconciliationPanel key={actorId} actorId={actorId} />}
    </div>
    <form className="flex flex-col sm:flex-row sm:items-start flex-wrap gap-4" onSubmit={e => { e.preventDefault(); if (beneficiaryId.trim()) setSelected({ kind, beneficiaryId: beneficiaryId.trim(), mode }); }}>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary" htmlFor="beneficiary-kind">Account type
        <Select id="beneficiary-kind" value={kind} onChange={e => setKind(e.target.value as BeneficiaryKind)} options={[{ value: 'SELLER', label: 'Seller' }, { value: 'AFFILIATE', label: 'Affiliate' }]} />
      </label>
      <Input label={kind === 'SELLER' ? 'Store ID' : 'Affiliate account ID'} id="beneficiary-id" className="min-h-11" value={beneficiaryId} onChange={e => setBeneficiaryId(e.target.value)} required maxLength={150} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary" htmlFor="platform-finance-mode">Environment
        <Select id="platform-finance-mode" value={mode} onChange={e => setMode(e.target.value as MoneyMode)} options={[{ value: 'LIVE', label: 'Live' }, { value: 'TEST', label: 'Test / sandbox' }]} />
      </label>
      <Button type="submit" className="sm:mt-7" disabled={!actorId || !beneficiaryId.trim()}>View verified account</Button>
    </form>
    {selected && actorId ? <div className="space-y-4">
      <h2 className="font-semibold text-secondary break-words">{selected.kind} account: {selected.beneficiaryId}</h2>
      <CapturedFinancePanel key={`${actorId}:${selected.kind}:${selected.beneficiaryId}:${selected.mode}`} actorId={actorId} storeId="platform"
        platform={{ kind: selected.kind, beneficiaryId: selected.beneficiaryId }} mode={selected.mode} />
    </div> : <p className="text-secondary">Choose an account to inspect captured funds, exact payout allocations and provider settlement evidence. Accounts and test/live funds are never combined.</p>}
  </div>;
}
