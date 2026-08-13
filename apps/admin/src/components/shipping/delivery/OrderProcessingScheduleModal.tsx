'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface Props {
  processesOnSaturday: boolean;
  processesOnSunday:   boolean;
  onClose: () => void;
  onSaved: (next: { processesOnSaturday: boolean; processesOnSunday: boolean }) => void;
}

function DayCheckbox({ label, checked, disabled, onChange }: {
  label:    string;
  checked:  boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'flex items-center gap-2 px-4 py-2.5 rounded-button border text-sm font-medium transition-colors',
        disabled
          ? 'border-border bg-muted/5 text-muted cursor-default'
          : checked
            ? 'border-secondary bg-secondary text-white'
            : 'border-border text-secondary hover:border-primary/40',
      ].join(' ')}
    >
      <span className={[
        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
        checked ? 'bg-white/20 border-white/60' : 'border-muted',
      ].join(' ')}>
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

export function OrderProcessingScheduleModal({ processesOnSaturday, processesOnSunday, onClose, onSaved }: Props) {
  const [sat, setSat] = useState(processesOnSaturday);
  const [sun, setSun] = useState(processesOnSunday);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleUpdate = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(API_ROUTES.ADMIN.SHIPPING_PROCESSING_SCHEDULE, {
        processesOnSaturday: sat,
        processesOnSunday:   sun,
      });
      onSaved({ processesOnSaturday: sat, processesOnSunday: sun });
    } catch (err) {
      setError((err as Error).message || 'Could not update your processing schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-secondary text-lg">Order processing schedule</h3>

        <p className="text-sm text-muted leading-relaxed">
          If you're preparing, packaging, or dispatching orders on Saturday or Sunday, you can add those days
          to your processing schedule to show shoppers more accurate delivery dates for future orders.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Keep in mind, adding Sunday to your schedule means you prepare or package orders that day — but you
          don't have to dispatch them. If a dispatch-by date falls on a Sunday, we'll always bump it to the
          next business day.
        </p>

        <div>
          <p className="text-sm font-semibold text-secondary mb-2">When do you process orders?</p>
          <p className="text-xs text-muted mb-3">Monday–Friday is standard and can't be changed</p>
          <div className="flex flex-wrap gap-2.5">
            <DayCheckbox label="Monday-Friday" checked disabled onChange={() => undefined} />
            <DayCheckbox label="Saturday" checked={sat} onChange={setSat} />
            <DayCheckbox label="Sunday"   checked={sun} onChange={setSun} />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-muted hover:text-secondary transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className="px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Updating…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
