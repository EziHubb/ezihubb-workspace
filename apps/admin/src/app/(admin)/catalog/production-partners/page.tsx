'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Factory, Pencil, Trash2, X, Check } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

interface ProductionPartner {
  id:          string;
  name:        string;
  description: string | null;
  location:    string | null;
}

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'block text-xs font-semibold text-secondary mb-1';

interface FormState {
  name:        string;
  description: string;
  location:    string;
}

const empty: FormState = { name: '', description: '', location: '' };

function PartnerForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  submitting,
  onCancel,
}: {
  value:       FormState;
  onChange:    (f: FormState) => void;
  onSubmit:    () => void;
  submitLabel: string;
  submitting:  boolean;
  onCancel?:   () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Name *</label>
        <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })}
          className={inputCls} placeholder="Partner name" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })}
          className={inputCls + ' resize-none'} rows={3} placeholder="Short description of this partner" />
      </div>
      <div>
        <label className={labelCls}>Location</label>
        <input value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })}
          className={inputCls} placeholder="e.g. Portland, OR · USA" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={onSubmit} disabled={!value.name.trim() || submitting}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50">
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm text-muted hover:text-secondary border border-border rounded-button transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProductionPartnersPage() {
  const qc = useQueryClient();
  const [form,     setForm]     = useState<FormState>(empty);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: partners = [], isLoading } = useQuery<ProductionPartner[]>({
    queryKey: ['admin-partners'],
    queryFn:  () => api.get<ProductionPartner[]>(API_ROUTES.ADMIN.PRODUCTION_PARTNERS),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (dto: FormState) => api.post(API_ROUTES.ADMIN.PRODUCTION_PARTNERS, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-partners'] }); setForm(empty); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...dto }: FormState & { id: string }) =>
      api.patch(API_ROUTES.ADMIN.PRODUCTION_PARTNER(id), dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-partners'] }); setEditId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(API_ROUTES.ADMIN.PRODUCTION_PARTNER(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-partners'] }); setDeleteId(null); },
  });

  const startEdit = (p: ProductionPartner) => {
    setEditId(p.id);
    setEditForm({ name: p.name, description: p.description ?? '', location: p.location ?? '' });
  };

  return (
    <>
      <AdminPageHeader
        title="Production Partners"
        subtitle="Manage production partners — used for transparency disclosures on product listings"
        queryKey={['admin-partners']}
      />

      <div className="max-w-[720px] space-y-5">
        {/* Create card */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <h4 className="font-semibold text-secondary text-sm mb-4">Add Partner</h4>
          <PartnerForm
            value={form}
            onChange={setForm}
            onSubmit={() => create.mutate(form)}
            submitLabel="Add Partner"
            submitting={create.isPending}
          />
          {create.isError && (
            <p className="text-xs text-red-600 mt-2">{(create.error as Error)?.message ?? 'Failed to create partner'}</p>
          )}
        </div>

        {/* List */}
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h4 className="font-semibold text-secondary text-sm">
              All Partners <span className="text-muted font-normal">({partners.length})</span>
            </h4>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-1.5">
                  <div className="h-4 w-40 bg-muted/10 rounded animate-pulse" />
                  <div className="h-3 w-64 bg-muted/10 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Factory className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No production partners yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {partners.map((p) => (
                <div key={p.id} className="px-5 py-4">
                  {editId === p.id ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-secondary">Editing: {p.name}</p>
                      <PartnerForm
                        value={editForm}
                        onChange={setEditForm}
                        onSubmit={() => update.mutate({ id: p.id, ...editForm })}
                        submitLabel="Save Changes"
                        submitting={update.isPending}
                        onCancel={() => setEditId(null)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-secondary text-sm">{p.name}</p>
                        {p.location && (
                          <p className="text-xs text-muted mt-0.5">{p.location}</p>
                        )}
                        {p.description && (
                          <p className="text-xs text-muted mt-1 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {deleteId === p.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600">Delete?</span>
                            <button type="button" onClick={() => remove.mutate(p.id)}
                              className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded">
                              Yes
                            </button>
                            <button type="button" onClick={() => setDeleteId(null)}
                              className="text-xs text-muted hover:bg-muted/10 px-2 py-1 rounded">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(p)}
                              className="p-1.5 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => setDeleteId(p.id)}
                              className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
