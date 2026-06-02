'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { clientFetch } from '../../../lib/api';
import { fetchArr } from '../../../lib/fmt';

interface ProcessingProfile {
  id:      string;
  name:    string;
  minDays: number;
  maxDays: number;
}

interface Props {
  profileId: string | null
  onChange: (id: string) => void
}

export function ProcessingProfileCard({ profileId, onChange }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: profiles = [] } = useQuery<ProcessingProfile[]>({
    queryKey: ['processing-profiles'],
    queryFn: () => clientFetch('/admin/processing-profiles').then(fetchArr<ProcessingProfile>),
    staleTime: 5 * 60_000,
  })

  const selected = profiles.find(p => p.id === profileId)

  return (
    <>
      <div className="border border-border rounded-xl p-4 flex items-center justify-between">
        {selected ? (
          <div>
            <p className="text-sm font-medium text-secondary">{selected.name}</p>
            <p className="text-sm text-muted">
              {selected.minDays}–{selected.maxDays} business days
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
          onClick={() => setIsModalOpen(true)}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 transition-colors"
        >
          {selected ? 'Change profile' : 'Select profile'}
        </button>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h4 className="font-semibold text-secondary">Processing profile</h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded hover:bg-muted/10 text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-muted mb-4">
                Select how long it takes to prepare your item for shipment.
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {profiles.map(profile => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      onChange(profile.id)
                      setIsModalOpen(false)
                    }}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                      profileId === profile.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40',
                    ].join(' ')}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${profileId === profile.id ? 'border-primary' : 'border-muted'}`}>
                      {profileId === profile.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary">{profile.name}</p>
                      <p className="text-xs text-muted">
                        {profile.minDays}–{profile.maxDays} business days
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Manage profiles in{' '}
                <a href="/admin/shipping" className="underline hover:text-secondary transition-colors">
                  Shipping settings
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
