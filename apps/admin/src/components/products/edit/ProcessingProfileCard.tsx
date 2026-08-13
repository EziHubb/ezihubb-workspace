'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, X } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ProcessingProfileModal } from '../../shipping/delivery/ProcessingProfileModal';
import type { ProcessingProfile } from '../../shipping/delivery/types';

const TYPE_LABEL: Record<ProcessingProfile['type'], string> = {
  MADE_TO_ORDER: 'Made to order',
  READY_TO_SHIP: 'Ready to dispatch',
};

interface Props {
  profileId: string | null;
  onChange:  (id: string) => void;
}

export function ProcessingProfileCard({ profileId, onChange }: Props) {
  const qc = useQueryClient();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);

  const { data: profiles = [] } = useQuery<ProcessingProfile[]>({
    queryKey: ['processing-profiles'],
    queryFn:  () => api.get<ProcessingProfile[]>(API_ROUTES.ADMIN.SHIPPING_PROCESSING_PROFILES),
    staleTime: 5 * 60_000,
  });

  const selected = profiles.find((p) => p.id === profileId);

  const handleCreated = (saved: ProcessingProfile) => {
    qc.invalidateQueries({ queryKey: ['processing-profiles'] });
    onChange(saved.id);
    setIsCreating(false);
    setIsPickerOpen(false);
  };

  return (
    <>
      <div className="border border-border rounded-xl p-4 flex items-center justify-between">
        {selected ? (
          <div>
            <p className="text-sm font-medium text-secondary">{TYPE_LABEL[selected.type]}</p>
            <p className="text-sm text-muted">
              {selected.minDays}-{selected.maxDays} days
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">No processing profile selected</p>
            <p className="text-xs text-muted">Required before publishing</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="text-xs font-semibold text-secondary bg-muted/10 hover:bg-muted/15 rounded-full px-4 py-2.5 transition-colors"
        >
          {selected ? 'Change profile' : 'Select profile'}
        </button>
      </div>

      {isPickerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h4 className="font-semibold text-secondary text-lg">Your processing profiles</h4>
                <p className="text-sm text-muted mt-0.5">Choose a profile or create a new one.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded hover:bg-muted/10 text-muted shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2 max-h-80 overflow-y-auto">
              <button
                type="button"
                onClick={() => { setIsPickerOpen(false); setIsCreating(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-semibold">Create new</span>
              </button>

              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    onChange(profile.id);
                    setIsPickerOpen(false);
                  }}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                    profileId === profile.id
                      ? 'border-secondary bg-muted/3'
                      : 'border-border hover:border-primary/40',
                  ].join(' ')}
                >
                  <div>
                    <p className="text-sm font-medium text-secondary">{TYPE_LABEL[profile.type]}</p>
                    <p className="text-xs text-muted">
                      {profile.minDays}-{profile.maxDays} days
                    </p>
                  </div>
                  {profileId === profile.id && (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> Applied
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="text-sm font-medium text-muted hover:text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreating && (
        <ProcessingProfileModal
          submitLabel="Apply"
          onClose={() => setIsCreating(false)}
          onSaved={handleCreated}
        />
      )}
    </>
  );
}
