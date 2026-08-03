'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, Layers } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtPercent } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SellerPlan {
  id:             string;
  name:           string;
  monthlyPrice:   number;
  maxProducts:    number | null;
  commissionRate: number;
  features:       string[];
  isActive:       boolean;
  sortOrder:      number;
}

const EMPTY: Omit<SellerPlan, 'id'> = {
  name:           '',
  monthlyPrice:   0,
  maxProducts:    null,
  commissionRate: 0.1,
  features:       [],
  isActive:       true,
  sortOrder:      0,
};

// ── Plan modal ────────────────────────────────────────────────────────────────

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan:    SellerPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form,    setForm]    = useState<Omit<SellerPlan, 'id'>>(plan ? {
    name:           plan.name,
    monthlyPrice:   plan.monthlyPrice,
    maxProducts:    plan.maxProducts,
    commissionRate: plan.commissionRate,
    features:       plan.features,
    isActive:       plan.isActive,
    sortOrder:      plan.sortOrder,
  } : { ...EMPTY });
  const [featText, setFeatText] = useState(form.features.join('\n'));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        features: featText.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (plan) {
        await api.patch(API_ROUTES.ADMIN.SELLER_PLAN(plan.id), payload);
      } else {
        await api.post(API_ROUTES.ADMIN.SELLER_PLANS, payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-secondary">{plan ? 'Edit Plan' : 'New Seller Plan'}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Plan Name *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Starter, Pro, Enterprise" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Monthly Price ($)</label>
              <input type="number" min={0} step={0.01} value={form.monthlyPrice}
                onChange={(e) => set('monthlyPrice', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Commission Rate</label>
              <input type="number" min={0} max={0.5} step={0.01} value={form.commissionRate}
                onChange={(e) => set('commissionRate', Number(e.target.value))} className={inputCls} placeholder="0.10 = 10%" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Max Products</label>
              <input type="number" min={1} value={form.maxProducts ?? ''} placeholder="Unlimited"
                onChange={(e) => set('maxProducts', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Sort Order</label>
              <input type="number" min={0} value={form.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Features (one per line)</label>
            <textarea
              rows={5}
              value={featText}
              onChange={(e) => setFeatText(e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder={"Unlimited listings\nPriority support\nAnalytics dashboard"}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-secondary">Active (visible to sellers)</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-button text-secondary hover:bg-muted/5 transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-button transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : plan ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan:     SellerPlan;
  onEdit:   (p: SellerPlan) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`bg-surface rounded-card border shadow-card p-5 flex flex-col gap-4 ${!plan.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-secondary text-base">{plan.name}</h3>
            {!plan.isActive && (
              <span className="text-[10px] font-semibold text-muted bg-muted/10 px-1.5 py-0.5 rounded-pill">Inactive</span>
            )}
          </div>
          <p className="text-2xl font-bold text-primary mt-1">
            {Number(plan.monthlyPrice) === 0 ? 'Free' : `${fmtAmount(plan.monthlyPrice)}/mo`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onEdit(plan)}
            className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onDelete(plan.id)}
            className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/5 rounded-button px-3 py-2">
          <p className="text-muted mb-0.5">Commission</p>
          <p className="font-bold text-secondary">{fmtPercent(plan.commissionRate)}</p>
        </div>
        <div className="bg-muted/5 rounded-button px-3 py-2">
          <p className="text-muted mb-0.5">Max Products</p>
          <p className="font-bold text-secondary">{plan.maxProducts ?? 'Unlimited'}</p>
        </div>
      </div>

      {plan.features.length > 0 && (
        <ul className="space-y-1.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-secondary">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerPlansPage() {
  const qc = useQueryClient();
  const { confirm, alert } = useDialog();
  const [modal, setModal] = useState<SellerPlan | null | 'new'>(null);

  const { data: plans = [], isLoading } = useQuery<SellerPlan[]>({
    queryKey: ['admin-seller-plans'],
    queryFn:  () => api.get<SellerPlan[]>(API_ROUTES.ADMIN.SELLER_PLANS),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-seller-plans'] });

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete this plan? This will fail if there are active subscribers.', { confirmLabel: 'Delete', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.SELLER_PLAN(id));
      invalidate();
    } catch (e: any) {
      await alert(e?.message ?? 'Failed to delete plan');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Seller Plans"
        subtitle="Manage subscription tiers and commissions for marketplace sellers"
        queryKey={['admin-seller-plans']}
      />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setModal('new')}
          className="flex items-center gap-1.5 text-sm font-semibold bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-button transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 bg-surface border border-border rounded-card animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-card">
          <Layers className="w-10 h-10 text-muted/30 mb-3" />
          <p className="font-semibold text-secondary">No seller plans yet</p>
          <p className="text-sm text-muted mt-1">Create your first plan to get started.</p>
          <button
            type="button"
            onClick={() => setModal('new')}
            className="mt-4 flex items-center gap-1.5 text-sm font-semibold bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={(p) => setModal(p)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <PlanModal
          plan={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={invalidate}
        />
      )}
    </>
  );
}
