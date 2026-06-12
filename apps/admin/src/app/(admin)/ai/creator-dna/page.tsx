'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dna, RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDateTime, fmtRelative, capitalize, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreatorDna {
  id:            string;
  userId:        string;
  creatorName:   string;
  email:         string;
  primaryStyle:  string | null;
  colorPalette:  string[];
  techniques:    string[];
  themes:        string[];
  audienceMatch: number | null;
  analysedAt:    string;
  summary:       string | null;
}

interface CreatorDnaResponse {
  data:       CreatorDna[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function Tag({ label, color = 'bg-primary/10 text-primary' }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {label}
    </span>
  );
}

// ── Audience score bar ────────────────────────────────────────────────────────

function AudienceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted text-xs">—</span>;
  const pct   = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums">{score}%</span>
    </div>
  );
}

// ── Expandable row ────────────────────────────────────────────────────────────

function DnaRow({
  dna,
  onReanalyze,
  reanalyzing,
}: {
  dna:          CreatorDna;
  onReanalyze:  (id: string) => void;
  reanalyzing:  boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="hover:bg-background transition-colors cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="px-4 py-3">
          <span className="text-muted">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-secondary">{dna.creatorName}</p>
          <p className="text-xs text-muted">{dna.email}</p>
        </td>
        <td className="px-4 py-3 text-sm text-secondary">{dna.primaryStyle ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {dna.colorPalette.slice(0, 4).map((c) => (
              <span key={c} className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </td>
        <td className="px-4 py-3"><AudienceBar score={dna.audienceMatch} /></td>
        <td className="px-4 py-3 text-xs text-muted">{fmtRelative(dna.analysedAt)}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onReanalyze(dna.id)}
            disabled={reanalyzing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-secondary border border-border rounded-button hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"
          >
            {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Reanalyze
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-background">
          <td colSpan={7} className="px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Techniques</p>
                <div className="flex flex-wrap gap-1">
                  {dna.techniques.length > 0
                    ? dna.techniques.map((t) => <Tag key={t} label={capitalize(t)} />)
                    : <span className="text-xs text-muted">None identified</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Themes</p>
                <div className="flex flex-wrap gap-1">
                  {dna.themes.length > 0
                    ? dna.themes.map((t) => <Tag key={t} label={capitalize(t)} color="bg-green-50 text-green-700" />)
                    : <span className="text-xs text-muted">None identified</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">AI Summary</p>
                {dna.summary
                  ? <p className="text-xs text-muted leading-relaxed">{dna.summary}</p>
                  : <em className="text-xs text-muted">No summary available.</em>}
                <p className="text-xs text-muted/50 mt-2">Analysed {fmtDateTime(dna.analysedAt)}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK = (page: number) => ['ai-creator-dna', page];

export default function AiCreatorDnaPage() {
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<CreatorDnaResponse>({
    queryKey: QK(page),
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      return api.get<CreatorDnaResponse>(`${API_ROUTES.ADMIN.AI_CREATOR_DNA_LIST}?${p}`);
    },
    staleTime: 60_000,
  });

  const reanalyze = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_CREATOR_DNA_REANALYZE(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-creator-dna'] }); },
  });

  const profiles   = safeArr(data?.data);
  const pagination = data?.pagination;

  return (
    <div>
      <AdminPageHeader
        title="Creator DNA"
        subtitle="AI-generated style and audience analysis for each creator"
        queryKey={QK(page)}
      />

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center">
            <Dna className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted">No Creator DNA profiles yet.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="w-8" />
                  {['Creator', 'Primary Style', 'Color Palette', 'Audience Match', 'Analysed', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((d) => (
                  <DnaRow
                    key={d.id}
                    dna={d}
                    onReanalyze={(id) => reanalyze.mutate(id)}
                    reanalyzing={reanalyze.isPending && actionId === d.id}
                  />
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Previous</button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
