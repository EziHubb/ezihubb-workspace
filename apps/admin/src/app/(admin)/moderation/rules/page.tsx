'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Settings2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type RuleTarget  = 'PRODUCT' | 'REVIEW' | 'STORE' | 'USER' | 'ALL';
type RuleAction  = 'FLAG' | 'AUTO_REJECT' | 'NOTIFY_SELLER' | 'ESCALATE';
type RuleTrigger = 'KEYWORD' | 'AI_SCORE' | 'REPORT_COUNT' | 'PATTERN';

interface ModerationRule {
  id:          string;
  name:        string;
  description: string | null;
  isActive:    boolean;
  target:      RuleTarget;
  trigger:     RuleTrigger;
  action:      RuleAction;
  threshold:   number | null;
  keywords:    string[] | null;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt:   string;
  updatedAt:   string;
  flagsLast30d: number;
}

interface RuleFormState {
  name:        string;
  description: string;
  target:      RuleTarget;
  trigger:     RuleTrigger;
  action:      RuleAction;
  threshold:   string;
  keywords:    string;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  LOW:      'bg-gray-100 text-gray-600',
  MEDIUM:   'bg-amber-100 text-amber-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const ACTION_LABELS: Record<RuleAction, string> = {
  FLAG:            'Flag for review',
  AUTO_REJECT:     'Auto-reject',
  NOTIFY_SELLER:   'Notify seller',
  ESCALATE:        'Escalate',
};

const EMPTY_FORM: RuleFormState = {
  name: '', description: '', target: 'ALL', trigger: 'KEYWORD',
  action: 'FLAG', threshold: '', keywords: '', severity: 'MEDIUM',
};

// ── Rule form modal ───────────────────────────────────────────────────────────

function RuleFormModal({
  initial,
  onSave,
  onClose,
  isPending,
}: {
  initial:   RuleFormState;
  onSave:    (data: RuleFormState) => void;
  onClose:   () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<RuleFormState>(initial);
  const set = <K extends keyof RuleFormState>(k: K, v: RuleFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid = form.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-card shadow-modal w-full max-w-lg my-8 p-6 space-y-4">
        <h3 className="font-semibold text-secondary text-base">
          {initial.name ? 'Edit Rule' : 'New Moderation Rule'}
        </h3>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Rule name <span className="text-error">*</span></label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
            className="w-full text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full text-sm border border-border rounded-button px-3 py-2 resize-none focus:outline-none focus:border-primary" />
        </div>

        {/* Target / Trigger / Action row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Target',  key: 'target'  as const, options: ['ALL', 'PRODUCT', 'REVIEW', 'STORE', 'USER'] },
            { label: 'Trigger', key: 'trigger' as const, options: ['KEYWORD', 'AI_SCORE', 'REPORT_COUNT', 'PATTERN'] },
            { label: 'Action',  key: 'action'  as const, options: ['FLAG', 'AUTO_REJECT', 'NOTIFY_SELLER', 'ESCALATE'] },
          ].map(({ label, key, options }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-secondary mb-1">{label}</label>
              <select value={form[key]} onChange={(e) => set(key, e.target.value as never)}
                className="w-full text-sm border border-border rounded-button px-2 py-2 focus:outline-none focus:border-primary">
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Severity</label>
          <div className="flex gap-2">
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((s) => (
              <button key={s} type="button" onClick={() => set('severity', s)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-button border transition-colors ${
                  form.severity === s ? SEVERITY_COLORS[s] + ' border-current' : 'border-border text-muted hover:border-muted'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields */}
        {(form.trigger === 'AI_SCORE' || form.trigger === 'REPORT_COUNT') && (
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Threshold {form.trigger === 'AI_SCORE' ? '(0–1, e.g. 0.8)' : '(report count)'}
            </label>
            <input type="number" step={form.trigger === 'AI_SCORE' ? '0.05' : '1'}
              min="0" max={form.trigger === 'AI_SCORE' ? '1' : undefined}
              value={form.threshold} onChange={(e) => set('threshold', e.target.value)}
              className="w-full text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary" />
          </div>
        )}
        {form.trigger === 'KEYWORD' && (
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Keywords (comma-separated)</label>
            <input type="text" placeholder="e.g. scam, fake, counterfeit"
              value={form.keywords} onChange={(e) => set('keywords', e.target.value)}
              className="w-full text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary" />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border rounded-button text-secondary hover:border-muted transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(form)}
            disabled={!valid || isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-button hover:bg-primary/90 transition-colors disabled:opacity-40">
            {isPending ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModerationRulesPage() {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const [showForm,    setShowForm   ] = useState(false);
  const [editingRule, setEditingRule] = useState<ModerationRule | null>(null);

  const { data: rules, isLoading } = useQuery<ModerationRule[]>({
    queryKey: ['admin-moderation-rules'],
    queryFn:  () => api.get<ModerationRule[]>(API_ROUTES.ADMIN.MODERATION_RULES),
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-moderation-rules'] });

  const createMutation = useMutation({
    mutationFn: (data: RuleFormState) => api.post(API_ROUTES.ADMIN.MODERATION_RULES, {
      ...data,
      threshold: data.threshold ? Number(data.threshold) : null,
      keywords:  data.keywords ? data.keywords.split(',').map((k) => k.trim()).filter(Boolean) : null,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleFormState }) =>
      api.patch(API_ROUTES.ADMIN.MODERATION_RULE(id), {
        ...data,
        threshold: data.threshold ? Number(data.threshold) : null,
        keywords:  data.keywords ? data.keywords.split(',').map((k) => k.trim()).filter(Boolean) : null,
      }),
    onSuccess: () => { invalidate(); setEditingRule(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(API_ROUTES.ADMIN.MODERATION_RULE_TOGGLE(id), { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(API_ROUTES.ADMIN.MODERATION_RULE(id)),
    onSuccess:  invalidate,
  });

  const ruleList = rules ?? [];

  return (
    <>
      <AdminPageHeader
        title="Moderation Rules"
        subtitle="Configure automated content moderation policies"
        queryKey={['admin-moderation-rules']}
      />

      {/* ── Quick stats ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 mb-8 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {ruleList.filter((r) => r.isActive).length} active rules
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          {ruleList.filter((r) => !r.isActive).length} disabled
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          {ruleList.reduce((s, r) => s + (r.flagsLast30d ?? 0), 0)} flags in last 30 days
        </span>
      </div>

      {/* ── Add rule button ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-secondary">Rules</h2>
        <button type="button" onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-button hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* ── Rules list ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/10 rounded-card animate-pulse" />
          ))}
        </div>
      ) : ruleList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-dashed border-border rounded-card">
          <Settings2 className="w-12 h-12 text-muted/30" />
          <p className="font-semibold text-secondary">No rules configured</p>
          <p className="text-sm text-muted">Create rules to automate content moderation.</p>
          <button type="button" onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-button hover:bg-primary/90 transition-colors mt-2">
            <Plus className="w-4 h-4" /> Create first rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {ruleList.map((rule) => (
            <div key={rule.id}
              className={`bg-surface border rounded-card p-5 transition-colors ${
                rule.isActive ? 'border-border' : 'border-border opacity-60'
              }`}>
              <div className="flex items-start gap-4">
                <button type="button"
                  onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                  className="mt-0.5 shrink-0 text-muted hover:text-primary transition-colors">
                  {rule.isActive
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft  className="w-6 h-6 text-muted" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-secondary text-sm">{rule.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[rule.severity]}`}>
                      {rule.severity}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                      {rule.trigger}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-secondary/10 text-secondary rounded-full">
                      {ACTION_LABELS[rule.action]}
                    </span>
                    {rule.target !== 'ALL' && (
                      <span className="text-[10px] font-medium text-muted">Target: {rule.target}</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted mb-1.5">{rule.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
                    {rule.threshold !== null && (
                      <span>Threshold: <span className="font-medium text-secondary">{rule.threshold}</span></span>
                    )}
                    {rule.keywords?.length ? (
                      <span>Keywords: <span className="font-medium text-secondary">{rule.keywords.join(', ')}</span></span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {rule.flagsLast30d ?? 0} flags (30d)
                    </span>
                    {!rule.isActive && (
                      <span className="text-muted italic">Disabled</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button type="button"
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 text-muted hover:text-primary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button"
                    onClick={async () => {
                      if (await confirm(`Delete rule "${rule.name}"?`, { confirmLabel: 'Delete', destructive: true })) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}
                    className="p-1.5 text-muted hover:text-error transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Info note ─────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-card text-sm text-blue-800">
        <Shield className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-semibold mb-0.5">How rules work</p>
          <p className="text-xs leading-relaxed">
            Rules are evaluated automatically when content is created or updated.
            <strong> FLAG</strong> adds items to the review queue.
            <strong> AUTO_REJECT</strong> immediately rejects content without manual review.
            <strong> NOTIFY_SELLER</strong> sends an alert without blocking publication.
            <strong> ESCALATE</strong> marks items as critical priority in the queue.
          </p>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showForm && (
        <RuleFormModal
          initial={EMPTY_FORM}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setShowForm(false)}
          isPending={createMutation.isPending}
        />
      )}
      {editingRule && (
        <RuleFormModal
          initial={{
            name:        editingRule.name,
            description: editingRule.description ?? '',
            target:      editingRule.target,
            trigger:     editingRule.trigger,
            action:      editingRule.action,
            threshold:   editingRule.threshold != null ? String(editingRule.threshold) : '',
            keywords:    editingRule.keywords?.join(', ') ?? '',
            severity:    editingRule.severity,
          }}
          onSave={(data) => updateMutation.mutate({ id: editingRule.id, data })}
          onClose={() => setEditingRule(null)}
          isPending={updateMutation.isPending}
        />
      )}
    </>
  );
}
