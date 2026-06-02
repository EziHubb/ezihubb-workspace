'use client';

import { useState } from 'react';
import { X, RotateCcw, ArrowRight, Check } from 'lucide-react';
import type { ReturnPolicy } from './types';

const POLICIES: { value: ReturnPolicy; label: string; desc: string; icon: React.ElementType }[] = [
  {
    value: 'NO_RETURNS',
    label: 'No returns or exchanges',
    desc:  'Buyer can contact seller about any issues with an order.',
    icon:  X,
  },
  {
    value: 'RETURNS_ACCEPTED',
    label: 'Returns accepted',
    desc:  'Buyers can return items within 30 days of delivery.',
    icon:  RotateCcw,
  },
  {
    value: 'EXCHANGES_ONLY',
    label: 'Exchanges only',
    desc:  'Buyers can exchange items within 30 days of delivery.',
    icon:  ArrowRight,
  },
]

interface Props {
  policy: ReturnPolicy
  onChange: (p: ReturnPolicy) => void
}

export function ReturnPolicyCard({ policy, onChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const selected = POLICIES.find(p => p.value === policy) ?? POLICIES[0]
  const Icon = selected.icon

  return (
    <div className="space-y-2">
      <div className="border-2 border-border rounded-xl p-4 flex items-start gap-4">
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-secondary">{selected.label}</p>
          <p className="text-xs text-muted mt-0.5">{selected.desc}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(v => !v)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          Change policy
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-2 pl-2">
          {POLICIES.map(p => {
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setIsExpanded(false) }}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                  policy === p.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${policy === p.value ? 'border-primary' : 'border-muted'}`}>
                  {policy === p.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${policy === p.value ? 'text-primary' : 'text-secondary'}`}>
                    {p.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{p.desc}</p>
                </div>
                {policy === p.value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
