'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate } from '../../../lib/fmt';
import { ReloadButton } from '../../../components/ui/ReloadButton';

interface ModerationLogRow {
  id: string;
  entityType: string;
  severity: string;
  reasoning: string | null;
  sellerMessage: string | null;
  createdAt: string;
}
interface StrikeRow { id: string; severity: string; createdAt: string }
interface ViolationsResponse { logs: ModerationLogRow[]; strikes: StrikeRow[] }

const POLICY_CARDS = [
  { title: 'The Ultimate Guide to Our Policy', desc: 'Learn why policies are created, how to avoid listing removals, and what we do to increase transparency.' },
  { title: 'Our Creativity Standards Policy', desc: 'Understand what can and can’t be sold on Ezihubb, the marketplace for original items from real people.' },
  { title: '4 Best Practices for Listings', desc: 'What to know when listing your items, along with actions you can take to avoid policy missteps.' },
];

export default function PolicyViolationsPage() {
  const { data, isLoading } = useQuery<ViolationsResponse>({
    queryKey: ['my-violations'],
    queryFn:  () => api.get<ViolationsResponse>(API_ROUTES.ADMIN.MY_VIOLATIONS),
  });

  const hasViolations = !!data && (data.logs.length > 0 || data.strikes.length > 0);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold text-secondary">Policy violations</h1>
        <ReloadButton queryKey={['my-violations']} />
      </div>
      <p className="text-sm text-muted mb-10">Find out if your listings aren&apos;t following our policies, and learn how it may affect your shop.</p>

      {isLoading ? (
        <div className="h-24 bg-surface rounded-card border border-border animate-pulse mb-10" />
      ) : !hasViolations ? (
        <div className="text-center py-10 mb-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-background flex items-center justify-center text-muted">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-secondary">All clear so far — keep it up!</p>
        </div>
      ) : (
        <div className="mb-10 space-y-2">
          {data!.strikes.map((s) => (
            <div key={s.id} className="flex items-start gap-3 bg-surface border border-error/30 rounded-card p-4">
              <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-secondary">Strike recorded — {s.severity.toLowerCase()}</p>
                <p className="text-xs text-muted mt-0.5">{fmtDate(s.createdAt)}</p>
              </div>
            </div>
          ))}
          {data!.logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 bg-surface border border-border rounded-card p-4">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-secondary">{l.entityType} flagged — {l.severity.toLowerCase()}</p>
                {(l.sellerMessage || l.reasoning) && <p className="text-xs text-muted mt-0.5">{l.sellerMessage ?? l.reasoning}</p>}
                <p className="text-xs text-muted mt-0.5">{fmtDate(l.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-bold text-secondary mb-1">Get to know our policies</h2>
        <p className="text-sm text-muted mb-4">These policies help protect our community and keep Ezihubb the marketplace for original items from real people.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {POLICY_CARDS.map((c) => (
            <div key={c.title} className="bg-surface border border-border rounded-card p-4">
              <h4 className="text-sm font-bold text-secondary mb-1.5">{c.title}</h4>
              <p className="text-xs text-muted leading-relaxed mb-3">{c.desc}</p>
              <span className="text-xs font-bold text-secondary">Read article →</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
